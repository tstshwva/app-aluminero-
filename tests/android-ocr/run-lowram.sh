#!/usr/bin/env bash
set -euo pipefail
adb install -r /tmp/aluformix-perf/Aluformix-cliente-demo.apk
adb shell cat /proc/meminfo > tests/android-ocr/perf-device-memory.txt
adb shell getprop dalvik.vm.heapsize > tests/android-ocr/perf-device-heap.txt
adb shell cat /sys/devices/system/cpu/present > tests/android-ocr/perf-device-cores.txt
test_status=0
gradle -p tests/android-ocr :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.aluformix.ocrprobe.LowRamUiTest --no-daemon || test_status=$?
adb shell dumpsys meminfo com.aluformix.cliente > tests/android-ocr/perf-meminfo.txt
adb shell dumpsys gfxinfo com.aluformix.cliente > tests/android-ocr/perf-gfxinfo.txt
adb shell screencap -p /sdcard/aluformix-perf.png
adb pull /sdcard/aluformix-perf.png tests/android-ocr/perf-screen.png
exit "$test_status"
