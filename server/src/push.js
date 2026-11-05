import { rows, acquireAppLock, releaseAppLock } from "./database.js";
export function createPushWorker(
  pool,
  { enabled = false, accessToken = "", fetchImpl = globalThis.fetch } = {},
) {
  let busy = false;
  const api = async (path, body) => {
    const response = await fetchImpl(
      "https://exp.host/--/api/v2/push/" + path,
      {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("Push temporalmente no disponible.");
    return response.json();
  };
  async function cycle() {
    if (!enabled || busy) return;
    busy = true;
    let lock = null;
    try {
      lock = await pool.getConnection();
      if (!(await acquireAppLock(lock, "aluformix_push_worker", 0))) return;
      const pending = await rows(
        pool,
        `SELECT o.*,d.push_token,n.order_id,CASE WHEN d.active=1 AND d.user_id=n.user_id AND u.active=1 AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6) THEN 1 ELSE 0 END AS valid FROM push_outbox o JOIN push_devices d ON d.id=o.device_id JOIN notifications n ON n.id=o.notification_id JOIN users u ON u.id=d.user_id LEFT JOIN auth_sessions s ON s.token_hash=d.session_hash WHERE o.status IN ('Pendiente','Ticket') AND o.next_attempt_at<=UTC_TIMESTAMP() ORDER BY o.id LIMIT 20`,
      );
      for (const item of pending) {
        if (Number(item.valid) !== 1) {
          await rows(
            pool,
            "UPDATE push_outbox SET status='Omitida' WHERE id=?",
            [item.id],
          );
          continue;
        }
        try {
          const attempts = Number(item.attempts) + 1;
          if (item.status === "Pendiente") {
            const reply = await api("send", {
              to: item.push_token,
              title: "Aluformix",
              body: "Hay una actualización en tus encargos. Abre la app para consultarla.",
              data: { orderId: item.order_id },
              channelId: "encargos",
              sound: "default",
              ttl: 3600,
            });
            const ticket = Array.isArray(reply.data)
              ? reply.data[0]
              : reply.data;
            if (
              ticket?.status === "ok" &&
              typeof ticket.id === "string" &&
              ticket.id.length <= 100
            )
              await rows(
                pool,
                "UPDATE push_outbox SET status='Ticket',ticket_id=?,attempts=?,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE) WHERE id=?",
                [ticket.id, attempts, item.id],
              );
            else if (ticket?.details?.error === "DeviceNotRegistered") {
              await rows(pool, "UPDATE push_devices SET active=0 WHERE id=?", [
                item.device_id,
              ]);
              await rows(
                pool,
                "UPDATE push_outbox SET status='Fallida' WHERE id=?",
                [item.id],
              );
            } else throw new Error();
          } else {
            const reply = await api("getReceipts", { ids: [item.ticket_id] }),
              receipt = reply.data?.[item.ticket_id];
            if (receipt?.status === "ok")
              await rows(
                pool,
                "UPDATE push_outbox SET status='Entregada' WHERE id=?",
                [item.id],
              );
            else if (receipt?.details?.error === "DeviceNotRegistered") {
              await rows(pool, "UPDATE push_devices SET active=0 WHERE id=?", [
                item.device_id,
              ]);
              await rows(
                pool,
                "UPDATE push_outbox SET status='Fallida' WHERE id=?",
                [item.id],
              );
            } else throw new Error();
          }
        } catch {
          await rows(
            pool,
            "UPDATE push_outbox SET status=CASE WHEN attempts+1>=5 THEN 'Fallida' ELSE status END,attempts=attempts+1,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE) WHERE id=?",
            [item.id],
          );
        }
      }
    } finally {
      if (lock) {
        try {
          await releaseAppLock(lock, "aluformix_push_worker");
        } finally {
          await lock.release();
        }
      }
      busy = false;
    }
  }
  return {
    cycle,
    start() {
      if (!enabled) return () => {};
      const tick = () =>
        cycle().catch(() =>
          console.error("No se pudo procesar la cola de avisos."),
        );
      const timer = setInterval(tick, 30000);
      timer.unref();
      tick();
      return () => clearInterval(timer);
    },
  };
}
