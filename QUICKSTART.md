# ACM Validation Agent - Quick Start

## 🚀 First Time? Start Here!

```bash
npm install
npm run setup
```

**That's it!** The setup wizard will guide you through configuration.

---

## ⚡ Validate a Bug (After Setup)

```bash
npm run validate:jira ACM-31343
```

Done! Check `test-cases/ACM-31343/` for results.

---

## 📚 Learn More

- **Setup help:** [ONBOARDING.md](ONBOARDING.md)
- **Usage guide:** [VALIDATOR-GUIDE.md](VALIDATOR-GUIDE.md)
- **Full docs:** [README.md](README.md)

---

## 🎯 What You'll Configure

1. **Test environment** - Live cluster or local kind
2. **Cluster credentials** - Username, password, console URL
3. **Tools** - Stagehand (AI-powered) or Puppeteer
4. **API key** - Anthropic API key for Stagehand
5. **Jira** - Optional Jira integration

All stored locally (gitignored - never committed).

---

## ✅ After Setup

Three ways to validate:

### 1. From Jira (Easiest)
```bash
npm run validate:jira ACM-XXXXX
```

### 2. Manual Bug Spec
```bash
mkdir test-cases/ACM-XXXXX
# Create bug-spec.json
npm run validate test-cases/ACM-XXXXX
```

### 3. Agent CLI
```bash
npm run agent -- validate config.json
```

---

**Ready? Run `npm run setup` now!**
