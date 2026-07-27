# Phase 8 Coordination Service

`services/coordination/` owns the declarative AI Coordination Layer.

It reads static registries and approved planning metadata, then writes read-only coordination reports under `runtime/coordination/`.

It does not execute work, call providers, deploy, schedule jobs, mutate existing runtime layers or trigger agents.
