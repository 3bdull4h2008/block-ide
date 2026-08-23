//! academy: level format v1 (PLAN.md step 4.1) — TOML per level with hidden
//! tests, hints, and a reference solution. One owner of the schema.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Level {
    pub id: String,
    /// world 1..=5 (PLAN 4.4: Hello&Output → Variables/Math → Control →
    /// Loops → Functions/Structs)
    pub world: u8,
    pub title: String,
    #[serde(default)]
    pub xp: u32,
    pub starter: String,
    /// every test must pass; ≥2 distinct stdin inputs required by lint
    pub tests: Vec<Test>,
    /// content lint: exactly 3 progressive hints
    pub hints: Vec<Hint>,
    /// path relative to the level file
    pub solution: Solution,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Hint {
    pub text: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Solution {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Test {
    #[serde(default)]
    pub stdin: String,
    /// exact expected stdout
    pub stdout: String,
    #[serde(default = "default_exit")]
    pub exit: i32,
}

fn default_exit() -> i32 {
    0
}

impl Level {
    pub fn parse_str(s: &str, dir: &std::path::Path) -> Result<Level, String> {
        let lv: Level = toml::from_str(s).map_err(|e| e.to_string())?;
        lv.validate(dir)?;
        Ok(lv)
    }

    pub fn load(path: &std::path::Path) -> Result<Level, String> {
        let text = std::fs::read_to_string(path)
            .map_err(|e| format!("{}: {e}", path.display()))?;
        let dir = path.parent().unwrap_or(std::path::Path::new("."));
        Level::parse_str(&text, dir)
    }

    fn validate(&self, dir: &std::path::Path) -> Result<(), String> {
        if self.id.trim().is_empty() {
            return Err("id empty".into());
        }
        if !(1..=5).contains(&self.world) {
            return Err(format!("world {} out of range 1..=5", self.world));
        }
        if self.title.trim().is_empty() {
            return Err("title empty".into());
        }
        if self.xp == 0 {
            return Err("xp must be > 0".into());
        }
        if self.tests.is_empty() {
            return Err("needs at least one hidden test".into());
        }
        let distinct: std::collections::HashSet<&str> =
            self.tests.iter().map(|t| t.stdin.as_str()).collect();
        if distinct.len() < 2 {
            return Err("anti-hardcode lint: need ≥2 distinct stdin inputs".into());
        }
        if self.hints.len() != 3 {
            return Err(format!(
                "content lint: exactly 3 hints required, got {}",
                self.hints.len()
            ));
        }
        if self.hints.iter().any(|h| h.text.trim().is_empty()) {
            return Err("content lint: hint text empty".into());
        }
        if !dir.join(&self.solution.path).is_file() {
            return Err(format!("solution file missing: {}", self.solution.path));
        }
        Ok(())
    }

    pub fn solution_src(&self, dir: &std::path::Path) -> Result<String, String> {
        std::fs::read_to_string(dir.join(&self.solution.path))
            .map_err(|e| format!("solution unreadable: {e}"))
    }
}
