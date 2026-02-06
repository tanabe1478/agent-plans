---
created: "2026-02-01T11:00:00Z"
modified: "2026-02-01T11:00:00Z"
project_path: "/home/user/projects/web-app"
session_id: "fixture-session-004"
status: todo
priority: critical
dueDate: "2026-02-03T00:00:00Z"
tags:
  - "database"
  - "migration"
assignee: "bob"
estimate: "2d"
schemaVersion: 1
---
# Database Migration Plan

## Overview
Migrate from PostgreSQL 12 to PostgreSQL 16 with zero downtime.

## Steps

### Preparation
- Backup current database
- Set up replication
- Test migration scripts

### Execution
- Enable logical replication
- Switchover to new instance
- Verify data integrity

## Rollback Plan
- Keep old instance running for 48 hours
- Automated rollback script ready
