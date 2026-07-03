//! NewSD Wasm numeric core — Story 1a.1 foundation stub.
//!
//! The real Float64 simulation engine arrives in epic 1b. This crate exists
//! now to establish the `wasm-pack test` toolchain (the third test language)
//! alongside `go test` and `vitest`, so all three are green from the first PR.
//!
//! Security design note (AD-1 four-pillar): the Wasm core is intended to be
//! the *only* place numeric formulas run. Formula strings are never `eval`-ed
//! in JS — the carried recursive-descent parser (`src/lib/sd/formula.ts`,
//! present now) parses them today; the native compile path arrives in epic 1b
//! (this crate is a stub). The "pasted content never reaches eval" runtime
//! guarantee is enforced at integration — no paste path is wired yet in this
//! foundation.

use wasm_bindgen::prelude::*;

/// Returns the numeric core version stamp. Placeholder until epic 1b.
#[wasm_bindgen]
pub fn core_version() -> String {
    String::from("newsd-core 0.1.0 (stub)")
}

#[cfg(test)]
mod tests {
    use wasm_bindgen_test::*;

    use crate::core_version;

    #[wasm_bindgen_test]
    fn core_version_is_nonempty() {
        assert!(!core_version().is_empty());
        assert!(core_version().starts_with("newsd-core"));
    }
}
