# ACM-30661 Validation Report

**Bug:** Automation alert when AAP is not installed is incorrect
**Date:** 3/26/2026, 2:01:47 PM
**Cluster:** your-cluster-name

## Environment

- **URL:** https://console-openshift-console.apps.your-cluster.example.com/multicloud/infrastructure/automations
- **Page Title:** Red Hat OpenShift
- **AAP Status:** Not installed (namespace empty)

## Findings

### Alerts: 5


#### Alert 1

**Element:** `DIV` matching `.pf-v6-c-alert`

**Content:**
```
Info alert:Operator requiredThe Ansible Automation Platform Operator is required to use automation templates. Version 2.2.1 or greater is required to use workflow job templates.Install the operator
```


#### Alert 2

**Element:** `H4` matching `[class*="alert"]`

**Content:**
```
Info alert:Operator required
```


#### Alert 3

**Element:** `DIV` matching `[class*="alert"]`

**Content:**
```
The Ansible Automation Platform Operator is required to use automation templates. Version 2.2.1 or greater is required to use workflow job templates.
```


#### Alert 4

**Element:** `DIV` matching `[class*="alert"]`

**Content:**
```
Install the operator
```


#### Alert 5

**Element:** `DIV` matching `[class*="banner"]`

**Content:**
```
You are logged in as a temporary administrative user. Update the cluster OAuth configuration to allow others to log in.
```




### Text Analysis

- **Ansible mentions:** 1
- **AAP mentions:** 0
- **Deprecation mentions:** 0


#### Sample Ansible Mentions
1. Ansible Automation Platform Operator is required to use automation templates.


## Evidence

1. **landing** - `final-1-landing.png`
2. **logged-in** - `final-2-logged-in.png`
3. **automation-page-loaded** - `final-3-automation-page-loaded.png`
4. **after-scroll** - `final-4-after-scroll.png`
5. **final-state** - `final-5-final-state.png`

## Conclusion


✅ **5 alert(s) found** on the Automation page.

Review the alerts above to determine if any match the bug description:
- Incorrect information about Ansible workflow deprecation
- Outdated message not reflecting current ACM capabilities


---
Generated: 3/26/2026, 2:01:47 PM
