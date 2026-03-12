# Schulsong Re-Upload Reset Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the engineer → teacher → auto-release pipeline when a new schulsong version is uploaded after a previous release.

**Architecture:** Two changes: (1) clear `schulsong_released_at` + `admin_approval_status` in the engineer upload-mixed route when a new schulsong is uploaded, and (2) make `setSchulsongReleasedAt` consistently reset `admin_approval_status` to `'pending'` when clearing the release date.

**Bug:** When an engineer uploads a new schulsong version after a previous release, the old `schulsong_released_at` and `admin_approval_status: "approved"` persist. This causes teacher re-approval to skip scheduling a new release (guarded by `!event.schulsong_released_at`) and the cron job to see stale data.

---

### Task 1: Make setSchulsongReleasedAt reset admin_approval_status when clearing

**Files:**
- Modify: `src/lib/services/airtableService.ts:3948-3955`

**Change:** Add else branch to reset `admin_approval_status` to `'pending'` when clearing the release date.

### Task 2: Clear release state when engineer uploads new schulsong version

**Files:**
- Modify: `src/app/api/engineer/events/[eventId]/upload-mixed/route.ts:216-247`

**Change:** After un-marking old schulsong files (line 225), call `airtableService.setSchulsongReleasedAt(eventId, '')` to clear the old release date and reset admin approval status.

### Task 3: Commit
