# Rule performance benchmarks

Run `pnpm bench` to measure the complete `recommended` and `recommendedTypeChecked` rule sets over
40 representative Solid components. The fixture exercises shared component recognition, reactive
binding facts, control-flow callbacks, stores, signals, and memos.

The benchmark intentionally has no timing assertion: absolute durations vary by machine and would
make CI flaky. Record results before and after analysis changes to detect regressions, comparing the
same runtime, dependency lockfile, and hardware.
