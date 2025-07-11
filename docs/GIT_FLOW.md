# 🌊 Git Flow Strategy

## 📋 **Branch Structure**

### **🎯 Main Branches**

| Branch    | Purpose                   | Deployment    | Protection   |
| --------- | ------------------------- | ------------- | ------------ |
| `main`    | **Production-ready code** | 🌟 Production | ✅ Protected |
| `develop` | **Integration branch**    | 🚀 Staging    | ✅ Protected |

### **🔧 Supporting Branches**

| Branch Type | Naming                          | Purpose             | Merge Into         |
| ----------- | ------------------------------- | ------------------- | ------------------ |
| `feature/*` | `feature/add-health-checks`     | New features        | `develop`          |
| `bugfix/*`  | `bugfix/fix-push-notifications` | Bug fixes           | `develop`          |
| `hotfix/*`  | `hotfix/critical-security-fix`  | Production fixes    | `main` + `develop` |
| `release/*` | `release/v1.2.0`                | Release preparation | `main` + `develop` |

## 🚀 **Deployment Strategy**

### **Development Workflow:**

```mermaid
graph LR
    A[feature/branch] --> B[develop]
    B --> C[staging]
    C --> D[main]
    D --> E[production]
```

### **Environment Mapping:**

- **`develop` branch** → **Staging Environment** (`ai-status-dashboard-dev`)
- **`main` branch** → **Production Environment** (`ai-status-dashboard-prod`)

## 📝 **Workflow Examples**

### **1. Adding a New Feature**

```bash
# Start from develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/add-analytics

# Work on feature
git add .
git commit -m "feat: add analytics dashboard"

# Push and create PR to develop
git push origin feature/add-analytics
gh pr create --base develop --title "Add analytics dashboard"
```

### **2. Deploying to Production**

```bash
# After develop is tested in staging, merge to main
git checkout main
git pull origin main
git merge develop

# Push to trigger production deployment
git push origin main
```

### **3. Emergency Hotfix**

```bash
# Start from main for critical fixes
git checkout main
git pull origin main

# Create hotfix branch
git checkout -b hotfix/security-patch

# Fix and test
git add .
git commit -m "fix: critical security vulnerability"

# Merge to both main and develop
git checkout main
git merge hotfix/security-patch
git push origin main

git checkout develop
git merge hotfix/security-patch
git push origin develop
```

## 🔒 **CI/CD Integration**

### **Automated Deployments:**

| Branch    | Trigger | Environment | Tests Required               |
| --------- | ------- | ----------- | ---------------------------- |
| `develop` | Push/PR | Staging     | Unit + Integration           |
| `main`    | Push    | Production  | All tests + Staging approval |

### **Protection Rules:**

**Main Branch:**

- ✅ Require PR reviews (2 approvals)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require deployment to staging first
- ❌ Allow force pushes

**Develop Branch:**

- ✅ Require PR reviews (1 approval)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ❌ Allow force pushes

## 🎯 **Best Practices**

### **✅ Do:**

- Always create feature branches from `develop`
- Use conventional commit messages (`feat:`, `fix:`, `docs:`)
- Test thoroughly in staging before merging to main
- Keep feature branches small and focused
- Delete merged branches

### **❌ Don't:**

- Push directly to `main` or `develop`
- Merge untested code to `develop`
- Skip CI/CD checks
- Create long-lived feature branches
- Force push to protected branches

## 🔄 **Release Process**

### **1. Prepare Release**

```bash
# Create release branch from develop
git checkout develop
git checkout -b release/v1.2.0

# Update version numbers, changelog
npm version minor
git add .
git commit -m "chore: prepare release v1.2.0"
```

### **2. Deploy to Staging**

```bash
# Push release branch (triggers staging deployment)
git push origin release/v1.2.0
```

### **3. Final Testing**

- ✅ Smoke tests on staging
- ✅ Performance validation
- ✅ Security scan
- ✅ User acceptance testing

### **4. Deploy to Production**

```bash
# Merge to main (triggers production deployment)
git checkout main
git merge release/v1.2.0
git push origin main

# Merge back to develop
git checkout develop
git merge release/v1.2.0
git push origin develop

# Clean up
git branch -d release/v1.2.0
git push origin --delete release/v1.2.0
```

## 🚨 **Emergency Procedures**

### **Production Rollback:**

```bash
# Identify last good commit
git log --oneline main

# Create rollback branch
git checkout -b hotfix/rollback-to-abc123 abc123

# Deploy rollback
git checkout main
git merge hotfix/rollback-to-abc123
git push origin main
```

### **Staging Recovery:**

```bash
# Reset develop to last good state
git checkout develop
git reset --hard origin/main
git push origin develop --force-with-lease
```

## 📊 **Monitoring**

### **Branch Health:**

- 🔍 **Staging**: Monitor `develop` branch deployments
- 🔍 **Production**: Monitor `main` branch deployments
- 🔍 **Features**: Track feature branch lifecycle

### **Deployment Metrics:**

- ⏱️ **Lead Time**: Feature → Production
- 🚀 **Deployment Frequency**: Daily/Weekly
- 🛡️ **Change Failure Rate**: < 5%
- 🔧 **Recovery Time**: < 1 hour

---

**Remember**: This Git Flow protects production while enabling rapid development! 🚀
