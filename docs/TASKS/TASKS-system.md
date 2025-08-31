# T.A.S.K.S: Tasks Are Sequenced Key Steps – LLM Execution Spec (v3)

_A comprehensive planning system that transforms technical documentation into validated, executable project plans with clear boundaries, existing codebase awareness, resource management, and support for both wave-based and rolling frontier execution models._

## Mission

Transform raw technical plans into executable project roadmaps by:

1. **Researching existing codebase** for reusable components and extension points
2. **Extracting features** and breaking them into bounded, measurable tasks
3. **Inferring structural dependencies** including mutual exclusions for shared resources
4. **Building an optimized execution graph** supporting multiple execution strategies
5. **Generating execution plans** for both wave-based and rolling frontier models
6. **Documenting design decisions** with alternatives considered
7. **Producing artifacts** as structured JSON/Markdown for automated execution

## Core Principles

### Task Boundaries & Execution Guidance

Every task must define:

- **Expected Complexity**: Quantifiable estimate (e.g., "~35 LoC", "3-5 functions", "2 API endpoints")
- **Definition of Done**: Clear stopping criteria to prevent scope creep
- **Scope Boundaries**: Explicit restrictions on what code/systems to modify
- **Logging Instructions**: Detailed guidance for execution agents on progress tracking
- **Resource Requirements**: CPU, memory, I/O needs and exclusive/shared resources

### Codebase-First Planning

Before task generation:

- **Inventory existing APIs**, interfaces, and components using ast-grep
- **Identify extension points** rather than creating duplicates
- **Document reuse opportunities** in Plan.md
- **Identify shared resources** that create mutual exclusion constraints
- **Justify new implementations** in Decisions.md when not extending existing code

### Evidence-Based Dependencies

All tasks and dependencies must:

- **Cite source evidence** from the planning document
- **Classify dependencies** as technical, sequential, infrastructure, knowledge, mutual_exclusion, or resource_limited
- **Assign confidence scores** [0..1] with rationale
- **Exclude pure resource constraints** (no "person X needs to be available" edges)
- **Include infrastructure constraints** (database locks, deployment slots, etc.)

### Execution Models

Support two execution strategies:

- **Wave-Based**: Synchronous waves with barriers, good for planning and estimation
- **Rolling Frontier**: Dynamic task scheduling with resource-aware coordination, optimal for execution

## Input Requirements

- **PLAN_DOC**: Raw technical specification (text/markdown)
- **Optional Parameters**:
  - `MIN_CONFIDENCE`: Minimum confidence for DAG inclusion (default: 0.7)
  - `MAX_WAVE_SIZE`: Maximum tasks per execution wave (default: 30)
  - `CODEBASE_PATH`: Repository root for analysis (default: current directory)
  - `EXECUTION_MODEL`: "wave_based" or "rolling_frontier" (default: "rolling_frontier")
  - `MAX_CONCURRENT_TASKS`: For rolling frontier model (default: 10)

## Required Output Artifacts

All outputs must use exact file fence format:

1. `---file:features.json` - High-level capabilities
2. `---file:tasks.json` - Detailed task definitions with boundaries and resources
3. `---file:dag.json` - Dependency graph and metrics
4. `---file:waves.json` - Execution waves and/or rolling frontier configuration
5. `---file:coordinator.json` - Coordinator configuration for rolling frontier
6. `---file:Plan.md` - Human-readable execution plan with codebase research
7. `---file:Decisions.md` - Design choices with alternatives and rationale

## Enhanced Schemas

### features.json

```json
{
  "generated": {
    "by": "T.A.S.K.S v3",
    "timestamp": "2025-08-13T00:00:00Z",
    "contentHash": "<sha256(normalizeJSON(file))>"
  },
  "features": [
    {
      "id": "F001",
      "title": "User Authentication System",
      "description": "OAuth2-based authentication with JWT tokens and social login support",
      "priority": "critical|high|medium|low",
      "source_evidence": [
        {
          "quote": "OAuth2 implementation with social providers required...",
          "loc": { "start": 123, "end": 178 },
          "section": "H2: Authentication",
          "startLine": 123,
          "endLine": 131
        }
      ]
    }
  ]
}
```

### tasks.json (v3 - Complete)

```json
{
  "meta": {
    "execution_model": "rolling_frontier",
    "min_confidence": 0.7,
    "resource_limits": {
      "max_concurrent_tasks": 10,
      "max_memory_gb": 32,
      "max_cpu_cores": 16,
      "max_disk_io_mbps": 500
    },
    "codebase_analysis": {
      "existing_apis": ["AuthService", "UserRepository", "ValidationService"],
      "reused_components": ["Logger", "ErrorHandler", "MetricsCollector"],
      "extension_points": ["BaseController", "AbstractAuthProvider"],
      "shared_resources": {
        "database_migrations": {
          "type": "exclusive",
          "location": "db/migrations/",
          "constraint": "sequential_only",
          "reason": "Migration tool locks schema during execution"
        },
        "deployment_pipeline": {
          "type": "exclusive",
          "location": "ci/deploy",
          "constraint": "one_at_a_time",
          "reason": "Single deployment slot to staging"
        },
        "test_db_pool": {
          "type": "shared_limited",
          "capacity": 3,
          "location": "test-db-pool",
          "reason": "Only 3 test database instances available"
        }
      }
    },
    "autonormalization": {
      "split": ["P1.T001->P1.T001a,P1.T001b (>16h)"],
      "merged": ["P1.T099,P1.T100 (<0.5h combined)"]
    }
  },
  "generated": {
    "by": "T.A.S.K.S v3",
    "timestamp": "2025-08-13T00:00:00Z",
    "contentHash": "<sha256(normalizeJSON(file))>"
  },
  "tasks": [
    {
      "id": "P1.T001",
      "feature_id": "F001",
      "title": "Implement OAuth2 authentication endpoints",
      "description": "Create REST API endpoints for OAuth2 flow with JWT tokens",
      "category": "foundation|implementation|integration|optimization",

      "boundaries": {
        "expected_complexity": {
          "value": "~120 LoC",
          "breakdown": "3 endpoints (40 LoC each), 2 middleware functions"
        },
        "definition_of_done": {
          "criteria": [
            "All 3 OAuth endpoints return correct status codes",
            "JWT tokens include required claims (sub, exp, iat)",
            "Integration tests pass with 95% coverage",
            "API documentation generated in OpenAPI format"
          ],
          "stop_when": "Do NOT implement refresh token rotation or MFA - separate task"
        },
        "scope": {
          "includes": ["src/api/auth/*.ts", "src/middleware/auth.ts"],
          "excludes": [
            "database migrations",
            "frontend components",
            "email notifications"
          ],
          "restrictions": "Modify only authentication-related files; do not touch user profile logic"
        }
      },

      "execution_guidance": {
        "logging": {
          "on_start": "Log 'Starting OAuth implementation' to logs/tasks/P1.T001.log with timestamp",
          "on_progress": "Log each endpoint completion with response time metrics",
          "on_completion": "Log summary with LoC added, test coverage %, and performance baseline",
          "log_format": "JSON with fields: {task_id, timestamp, event, metrics, errors}"
        },
        "checkpoints": [
          "After endpoint 1: Run auth integration tests",
          "After middleware: Verify token validation with curl",
          "Before completion: Generate and review API docs"
        ],
        "monitoring": {
          "heartbeat_interval_seconds": 30,
          "progress_reporting": "percentage_and_checkpoint",
          "resource_usage_reporting": true,
          "checkpoint_events": [
            { "at": "25%", "name": "schema_created", "rollback_capable": true },
            {
              "at": "50%",
              "name": "endpoints_implemented",
              "rollback_capable": true
            },
            { "at": "75%", "name": "tests_passing", "rollback_capable": false }
          ]
        }
      },

      "resource_requirements": {
        "estimated": {
          "cpu_cores": 2,
          "memory_mb": 512,
          "disk_io_mbps": 10,
          "exclusive_resources": ["database_migrations"],
          "shared_resources": { "test_db_pool": 1 }
        },
        "peak": {
          "cpu_cores": 4,
          "memory_mb": 1024,
          "disk_io_mbps": 50,
          "duration_seconds": 30,
          "during": "Running test suite"
        },
        "worker_capabilities_required": ["backend", "database"]
      },

      "scheduling_hints": {
        "priority": "high",
        "preemptible": false,
        "retry_on_failure": true,
        "max_retries": 2,
        "preferred_time_window": "business_hours",
        "avoid_concurrent_with": ["P1.T004", "P1.T006"],
        "can_pause_resume": false,
        "checkpoint_capable": true
      },

      "reuses_existing": {
        "extends": ["BaseController", "AbstractAuthProvider"],
        "imports": ["Logger", "ValidationService", "ErrorHandler"],
        "rationale": "Leveraging existing auth abstractions reduces code by ~40%"
      },

      "skillsRequired": ["backend", "node", "oauth"],
      "duration": {
        "optimistic": 4,
        "mostLikely": 6,
        "pessimistic": 10
      },
      "durationUnits": "hours",

      "interfaces_produced": ["AuthAPI:v2", "JWTClaims:v1"],
      "interfaces_consumed": ["UserRepository:v1", "ConfigService:v1"],

      "acceptance_checks": [
        {
          "type": "command",
          "cmd": "npm test -- --testPathPattern=auth",
          "expect": {
            "passRateGte": 0.95,
            "coverageGte": 0.95
          }
        },
        {
          "type": "artifact",
          "path": "docs/api/auth-v2.yaml",
          "expect": {
            "exists": true,
            "validOpenAPI": true
          }
        },
        {
          "type": "metric",
          "name": "auth_endpoint_p95_ms",
          "expect": {
            "lte": 100
          }
        }
      ],

      "source_evidence": [
        {
          "quote": "OAuth2 implementation with JWT tokens required...",
          "loc": { "start": 234, "end": 298 },
          "section": "H2: Authentication Requirements",
          "startLine": 45,
          "endLine": 52
        }
      ],
      "contentHash": "a1b2c3d4e5f6789a"
    }
  ],
  "dependencies": [
    {
      "from": "P1.T001",
      "to": "P1.T002",
      "type": "technical",
      "reason": "T002 requires AuthAPI:v2 interface from T001",
      "evidence": [
        {
          "type": "doc",
          "reason": "Spec states user service depends on auth tokens",
          "confidence": 0.9
        }
      ],
      "confidence": 0.85,
      "isHard": true
    },
    {
      "from": "P1.T001",
      "to": "P1.T004",
      "type": "mutual_exclusion",
      "reason": "Both require exclusive access to database migration tool",
      "shared_resource": "database_migrations",
      "evidence": [
        {
          "type": "infrastructure",
          "reason": "Migration tool uses schema lock preventing concurrent migrations",
          "confidence": 1.0
        }
      ],
      "confidence": 1.0,
      "isHard": true
    }
  ],
  "resource_conflicts": {
    "database_migrations": {
      "tasks": ["P1.T001", "P1.T004", "P1.T006"],
      "resolution": "sequential_ordering",
      "suggested_order": ["P1.T001", "P1.T004", "P1.T006"],
      "rationale": "Ordered by logical schema dependencies: auth → users → analytics"
    },
    "deployment_pipeline": {
      "tasks": ["P1.T010", "P1.T011", "P1.T015"],
      "resolution": "wave_separation",
      "rationale": "Each deployment requires full pipeline; separate into different waves"
    }
  }
}
```

### dag.json (v3)

```json
{
  "ok": true,
  "errors": [],
  "warnings": [],
  "generated": {
    "by": "T.A.S.K.S v3",
    "timestamp": "2025-08-13T00:00:00Z",
    "contentHash": "<sha256(normalizeJSON(file))>"
  },
  "metrics": {
    "minConfidenceApplied": 0.7,
    "keptByType": {
      "technical": 45,
      "sequential": 32,
      "infrastructure": 18,
      "knowledge": 26,
      "mutual_exclusion": 12,
      "resource_limited": 8
    },
    "droppedByType": {
      "technical": 3,
      "sequential": 2,
      "infrastructure": 0,
      "knowledge": 1
    },
    "nodes": 84,
    "edges": 141,
    "edgeDensity": 0.02,
    "widthApprox": 18,
    "widthMethod": "kahn_layer_max",
    "longestPath": 7,
    "isolatedTasks": 0,
    "lowConfidenceEdgesExcluded": 6,
    "verbFirstPct": 0.92,
    "meceOverlapSuspects": 0,
    "mutualExclusionEdges": 12,
    "resourceConstrainedTasks": 26,
    "resourceUtilization": {
      "database_migrations": {
        "total_tasks": 6,
        "waves_required": 6,
        "serialization_impact": "adds 2 waves to critical path"
      },
      "deployment_pipeline": {
        "total_tasks": 8,
        "waves_required": 8,
        "serialization_impact": "adds 3 waves to critical path"
      },
      "test_db_pool": {
        "total_tasks": 15,
        "capacity": 3,
        "waves_required": 5,
        "utilization": "60% average, 100% peak in wave 3"
      }
    }
  },
  "topo_order": ["P1.T005", "P1.T001", "P1.T009", "..."],
  "reduced_edges_sample": [
    ["P1.T001", "P1.T010"],
    ["P1.T010", "P1.T020"]
  ],
  "resource_bottlenecks": [
    {
      "resource": "database_migrations",
      "impact": "critical_path_extension",
      "affected_tasks": ["P1.T001", "P1.T004", "P1.T006"],
      "mitigation": "Consider combining migrations where possible"
    }
  ],
  "softDeps": [
    {
      "from": "P1.T010",
      "to": "P1.T020",
      "type": "knowledge",
      "reason": "Lessons from spike inform API design",
      "confidence": 0.6,
      "isHard": false
    }
  ],
  "lowConfidenceDeps": [
    {
      "from": "P1.T012",
      "to": "P1.T017",
      "type": "sequential",
      "confidence": 0.62,
      "reason": "UI mockups may inform backend data model"
    }
  ],
  "cycle_break_suggestions": []
}
```

### waves.json (v3 - Supporting Both Models)

```json
{
  "planId": "PLAN-a1b2c3d4",
  "generated": {
    "by": "T.A.S.K.S v3",
    "timestamp": "2025-08-13T00:00:00Z",
    "contentHash": "<sha256(normalizeJSON(file))>"
  },
  "execution_models": {
    "wave_based": {
      "config": {
        "maxWaveSize": 30,
        "barrier": {
          "kind": "quorum",
          "quorum": 0.95
        }
      },
      "waves": [
        {
          "waveNumber": 1,
          "tasks": ["P1.T005", "P1.T001", "P1.T009"],
          "estimates": {
            "units": "hours",
            "p50Hours": 10.5,
            "p80Hours": 12.0,
            "p95Hours": 14.2
          },
          "resource_usage": {
            "database_migrations": 1,
            "test_db_pool": 2,
            "estimated_cpu_cores": 6,
            "estimated_memory_gb": 2
          },
          "barrier": {
            "kind": "quorum",
            "quorum": 0.95,
            "timeoutMinutes": 120,
            "fallback": "deferOptional",
            "gateId": "W1→W2-q95"
          }
        }
      ],
      "total_waves": 8,
      "estimated_completion": {
        "p50_hours": 54,
        "p80_hours": 68,
        "p95_hours": 82
      }
    },

    "rolling_frontier": {
      "initial_frontier": ["P1.T001", "P1.T005", "P1.T009"],
      "config": {
        "max_concurrent_tasks": 10,
        "scheduling_algorithm": "resource_aware_greedy",
        "frontier_update_policy": "immediate",
        "coordinator_config_ref": "coordinator.json"
      },
      "estimated_completion_time": {
        "optimal_hours": 28,
        "p50_hours": 35,
        "p95_hours": 48
      },
      "resource_utilization_forecast": {
        "average_cpu_percent": 65,
        "peak_cpu_percent": 85,
        "average_memory_percent": 60,
        "peak_memory_percent": 80,
        "average_concurrency": 6.5,
        "max_concurrency": 10
      },
      "critical_resource_contentions": [
        {
          "resource": "database_migrations",
          "contention_points": 6,
          "estimated_wait_time_hours": 3,
          "mitigation": "Schedule during low-activity periods"
        }
      ],
      "execution_simulation": {
        "time_0h": {
          "running": ["P1.T001", "P1.T005", "P1.T009"],
          "ready": [],
          "blocked": ["P1.T002", "P1.T003", "P1.T004"],
          "resource_usage": {
            "cpu_cores": 6,
            "memory_gb": 1.5,
            "database_migrations": 1,
            "test_db_pool": 2
          }
        },
        "time_4h": {
          "running": ["P1.T002", "P1.T003", "P1.T010"],
          "ready": ["P1.T004"],
          "blocked": ["P1.T011", "P1.T012"],
          "completed": ["P1.T001", "P1.T005", "P1.T009"],
          "resource_usage": {
            "cpu_cores": 8,
            "memory_gb": 2.5,
            "database_migrations": 0,
            "test_db_pool": 1
          }
        }
      },
      "advantages_over_wave_based": [
        "35% faster completion (35h vs 54h)",
        "Better resource utilization (65% vs 40%)",
        "Adaptive to actual task completion times",
        "No waiting for slowest task in wave"
      ]
    }
  }
}
```

### coordinator.json (NEW for Rolling Frontier)

```json
{
  "coordinator": {
    "role": "execution_orchestrator",
    "version": "1.0.0",
    "responsibilities": [
      "Monitor system resources (CPU, memory, I/O)",
      "Manage task frontier (ready queue)",
      "Assign tasks to workers based on capabilities",
      "Enforce resource limits and mutual exclusions",
      "Handle backpressure and circuit breaking",
      "Track progress and manage checkpoints",
      "Coordinate rollbacks on failure"
    ],

    "state_management": {
      "task_states": {
        "blocked": "Dependencies not met",
        "ready": "In frontier, awaiting resources",
        "queued": "Resources available, awaiting worker",
        "assigned": "Assigned to worker",
        "running": "Actively executing",
        "paused": "Temporarily suspended for resources",
        "checkpointed": "At a checkpoint, can resume",
        "completed": "Successfully finished",
        "failed": "Execution failed",
        "rolled_back": "Reverted after failure"
      },

      "frontier_management": {
        "ready_queue": [],
        "resource_wait_queue": [],
        "worker_assignments": {},
        "resource_allocations": {},
        "checkpoint_registry": {}
      }
    },

    "scheduling_loop": {
      "interval_ms": 1000,
      "steps": [
        "update_frontier()",
        "check_system_health()",
        "apply_backpressure()",
        "prioritize_ready_tasks()",
        "match_tasks_to_workers()",
        "dispatch_tasks()",
        "monitor_running_tasks()",
        "handle_completions()",
        "update_metrics()"
      ]
    },

    "policies": {
      "backpressure": {
        "triggers": [
          {
            "metric": "cpu_usage",
            "threshold": 80,
            "action": "pause_low_priority"
          },
          {
            "metric": "memory_usage",
            "threshold": 85,
            "action": "defer_memory_intensive"
          },
          { "metric": "error_rate", "threshold": 5, "action": "circuit_break" }
        ],
        "recovery": {
          "cool_down_seconds": 30,
          "gradual_resume": true,
          "resume_rate": 1
        }
      },

      "resource_allocation": {
        "strategy": "bin_packing_with_headroom",
        "headroom_percent": 20,
        "oversubscription_allowed": false,
        "preemption_enabled": true,
        "preemption_priorities": ["low", "medium", "high", "critical"]
      },

      "worker_matching": {
        "strategy": "capability_and_load_balanced",
        "prefer_specialized_workers": true,
        "max_tasks_per_worker": 3
      },

      "failure_handling": {
        "retry_policy": "exponential_backoff",
        "max_retries": 3,
        "failure_threshold": 0.3,
        "cascade_prevention": true,
        "checkpoint_recovery": true
      }
    },

    "monitoring": {
      "metrics_collection_interval": 10,
      "metrics": [
        "task_throughput",
        "average_wait_time",
        "resource_utilization",
        "failure_rate",
        "checkpoint_success_rate"
      ],
      "alerts": [
        {
          "condition": "failure_rate > 0.1",
          "action": "reduce_concurrency",
          "notify": "logs/alerts.log"
        }
      ]
    }
  },

  "worker_pool": {
    "min_workers": 2,
    "max_workers": 8,
    "scaling_policy": "adaptive",
    "worker_template": {
      "capabilities": ["backend", "frontend", "database", "testing"],
      "resource_capacity": {
        "cpu_cores": 4,
        "memory_mb": 8192,
        "disk_io_mbps": 100
      },
      "execution_protocol": {
        "heartbeat_interval": 30,
        "progress_updates": true,
        "can_checkpoint": true
      }
    }
  }
}
```

### Plan.md (v3 - Complete)

```markdown
# Execution Plan

## Execution Strategy Recommendation: Rolling Frontier

### Why Rolling Frontier?

- 35% faster completion than wave-based (35h vs 54h)
- Better resource utilization (65% avg vs 40% with waves)
- Adaptive to actual task completion times
- Automatic handling of faster/slower tasks
- No artificial synchronization delays

### System Resource Requirements

- **Peak**: 16 CPU cores, 32GB RAM, 500 Mbps I/O
- **Average**: 10 CPU cores, 20GB RAM, 100 Mbps I/O
- **Worker Pool**: 2-8 adaptive workers with mixed capabilities

## Codebase Analysis Results

### Existing Components Leveraged (47% code reuse)

- **AuthService**: Extended for OAuth2 support (saves ~200 LoC)
- **Logger**: Reused for all task logging and monitoring
- **ValidationService**: Used for input validation across all endpoints
- **BaseController**: Extended by 12 new controllers
- **ErrorHandler**: Consistent error handling across all tasks

### New Interfaces Required

- **PaymentGateway**: No existing implementation found
- **ReportGenerator**: Current version inadequate for requirements
- **WebSocketManager**: New real-time communication layer

### Architecture Patterns Identified

- Repository pattern for data access (used in 18 tasks)
- Factory pattern for service instantiation (used in 8 tasks)
- Observer pattern for event handling (used in 6 tasks)

### Shared Resources Creating Constraints

- **Database Migrations**: 6 tasks require exclusive access (adds 8h to critical path)
- **Deployment Pipeline**: 8 tasks need deployment (serialized execution)
- **Test Database Pool**: 15 tasks share 3 instances (managed concurrency)

## Execution Metrics

| Metric                | Value    | Impact                              |
| --------------------- | -------- | ----------------------------------- |
| Total Tasks           | 84       | -                                   |
| Total Dependencies    | 141      | Including 12 mutual exclusions      |
| Edge Density          | 0.020    | Well-balanced, not over-constrained |
| Critical Path         | 7 stages | Minimum completion time             |
| Max Parallelization   | 18 tasks | Peak concurrent execution           |
| Verb-First Compliance | 92%      | Clear, action-oriented naming       |
| Codebase Reuse        | 47%      | Significant efficiency gain         |
| Resource Conflicts    | 26 tasks | Requires careful scheduling         |

## Wave-Based Execution Plan

### Wave 1: Foundation (P50: 12h, P80: 16h, P95: 22h)

**Tasks**: P1.T001, P1.T005, P1.T009
**Resource Usage**:

- database_migrations: 1/1 (P1.T001 exclusive)
- test_db_pool: 2/3 (P1.T005, P1.T009)
- CPU: 6 cores, Memory: 2GB

**Quality Gates**:

- ✅ All foundation APIs documented (OpenAPI spec exists)
- ✅ Database migrations applied (schema version updated)
- ✅ CI/CD pipeline operational (builds passing)
- ✅ Base error handling implemented (>95% coverage)

**Note**: P1.T004 deferred to Wave 2 due to migration lock conflict

### Wave 2: Core Implementation (P50: 14h, P80: 18h, P95: 24h)

**Tasks**: P1.T002, P1.T003, P1.T004, P1.T010
**Resource Usage**:

- database_migrations: 1/1 (P1.T004 exclusive)
- test_db_pool: 3/3 (full utilization)
- deployment_pipeline: 1/1 (P1.T010)
- CPU: 12 cores, Memory: 6GB

**Quality Gates**:

- ✅ Integration tests passing (>90% coverage)
- ✅ API endpoints responding (<200ms p95)
- ✅ Staging deployment successful
- ✅ Monitoring dashboards active

[Additional waves 3-8 with similar detail...]

### Total Wave-Based Timeline

- **P50**: 54 hours (6.75 working days)
- **P80**: 68 hours (8.5 working days)
- **P95**: 82 hours (10.25 working days)

## Rolling Frontier Execution Plan

### Initial Frontier (Time 0h)

**Ready to Execute**: P1.T001, P1.T005, P1.T009
**Resource Allocation**:

- P1.T001 → Worker-1 (backend specialist, holds database_migrations lock)
- P1.T005 → Worker-2 (testing specialist, uses test_db_pool #1)
- P1.T009 → Worker-3 (frontend specialist, uses test_db_pool #2)

### Execution Timeline Simulation

#### Time 4h: First Completions

**Completed**: P1.T009 (faster than estimated)
**Still Running**: P1.T001, P1.T005
**Newly Ready**: P1.T013 (dependent on P1.T009)
**Action**: Worker-3 picks up P1.T013

#### Time 6h: Migration Complete

**Completed**: P1.T001 (releases database_migrations)
**Newly Ready**: P1.T002, P1.T004
**Action**:

- Worker-1 picks up P1.T002
- P1.T004 queued for database_migrations (next available)

#### Time 8h: Resource Contention

**Running**: 7 tasks (approaching CPU limit)
**Coordinator Action**: Apply backpressure

- Defer low-priority task P1.T018
- Pause P1.T015 at checkpoint
- Prioritize critical path tasks

[Continue simulation through completion...]

### Rolling Frontier Advantages

1. **Efficiency**: Complete in 35h vs 54h wave-based
2. **Adaptability**: Handles variable task durations
3. **Resource Optimization**: 65% average utilization vs 40%
4. **Continuous Progress**: No artificial wait points
5. **Failure Resilience**: Checkpoint/resume capability

## Risk Analysis

### High-Risk Dependencies

1. **Database Migration Sequence** (Confidence: 1.0)
   - Risk: Schema conflicts if order violated
   - Mitigation: Enforced exclusive locks
2. **API Version Dependencies** (Confidence: 0.85)
   - Risk: Breaking changes in interfaces
   - Mitigation: Version pinning and contract tests

### Low-Confidence Dependencies (require validation)

- P1.T012 → P1.T017 (UI/Backend sync, confidence: 0.62)
- P1.T023 → P1.T029 (Data model assumptions, confidence: 0.65)

### Soft Dependencies (parallelizable)

- P1.T010 → P1.T020 (Knowledge transfer, can proceed independently)
- P1.T031 → P1.T035 (Optimization suggestions, non-blocking)

## Resource Bottleneck Analysis

### Database Migrations (Critical)

- **Impact**: Extends critical path by 8 hours
- **Affected Tasks**: 6 tasks require exclusive access
- **Mitigation**:
  - Combine compatible migrations where safe
  - Schedule during low-activity periods
  - Consider migration batching tool

### Test Database Pool (Moderate)

- **Impact**: May delay testing tasks by 1-2 hours
- **Capacity**: 3 instances for 15 tasks
- **Mitigation**:
  - Implement test data isolation
  - Add dynamic pool expansion if needed

### Deployment Pipeline (Low)

- **Impact**: Sequential deployments add 4 hours
- **Mitigation**: Implement blue-green deployment

## Auto-Normalization Actions Taken

### Task Splits (Exceeded 16h limit)

- P1.T045 → P1.T045a (Schema design, 8h) + P1.T045b (Implementation, 8h)
- P1.T067 → P1.T067a (API design, 6h) + P1.T067b (Testing, 10h)

### Task Merges (Under 0.5h threshold)

- P1.T099 + P1.T100 → P1.T099 (Combined config updates, 0.8h)
- P1.T103 + P1.T104 + P1.T105 → P1.T103 (Bundled hotfixes, 1.2h)

## Success Metrics

- ✅ All tasks have clear boundaries and completion criteria
- ✅ 92% verb-first task naming compliance
- ✅ 47% existing code reuse documented
- ✅ 100% tasks have machine-verifiable acceptance checks
- ✅ Resource conflicts identified and mitigated
- ✅ Both execution models fully specified
```

### Decisions.md (v3)

```markdown
# Design Decisions Log

## Decision 1: Execution Model Selection

### Context

Project requires execution strategy that balances planning clarity with execution efficiency.

### Options Considered

#### Option A: Pure Wave-Based Execution

- **Pros**: Simple synchronization, predictable phases, clear checkpoints
- **Cons**: Artificial delays, poor resource utilization (40%), 54h completion
- **Best For**: Projects requiring strict phase gates

#### Option B: Pure Rolling Frontier (SELECTED)

- **Pros**: 35% faster (35h), 65% resource utilization, adaptive scheduling
- **Cons**: Complex coordination, requires robust monitoring
- **Best For**: Projects prioritizing speed and efficiency

#### Option C: Hybrid Approach

- **Pros**: Critical checkpoints with dynamic execution between
- **Cons**: Complex to implement, mixed mental model
- **Best For**: High-risk projects needing both speed and control

### Rationale

Rolling Frontier selected for:

- Significant time savings (19 hours)
- Better resource utilization
- Checkpoint capability provides safety
- Coordinator can enforce phase gates if needed

### Implementation Notes

- Use coordinator.json configuration
- Implement gradual backpressure
- Monitor resource utilization continuously
- Checkpoint at 25%, 50%, 75% progress

---

## Decision 2: OAuth2 Implementation Strategy

### Context

Authentication system requires industry-standard security with JWT tokens.

### Options Considered

#### Option A: Extend existing BasicAuth module

- **Pros**: Minimal new code, familiar codebase
- **Cons**: BasicAuth architecture incompatible with OAuth flows
- **Estimated Effort**: 8 hours + significant refactoring
- **Code Reuse**: 20%

#### Option B: Implement from scratch

- **Pros**: Clean architecture, no legacy constraints
- **Cons**: Duplicate functionality, 200+ LoC
- **Estimated Effort**: 12 hours
- **Code Reuse**: 0%

#### Option C: Extend BaseAuthProvider with OAuth2 strategy (SELECTED)

- **Pros**: Reuses validation/logging/error handling, clean separation
- **Cons**: Requires learning provider pattern
- **Estimated Effort**: 6 hours
- **Code Reuse**: 47%

### Rationale

Best balance of reuse and clean architecture:

- Saves 6 hours vs from-scratch
- Maintains existing logging/monitoring
- Follows established patterns
- Enables future auth methods

### Implementation Notes

- Extend BaseAuthProvider abstract class
- Implement OAuth2Strategy class
- Reuse ValidationService for input sanitization
- Keep JWT logic in separate module

---

## Decision 3: Database Migration Sequencing

### Context

6 tasks require database migrations with exclusive schema lock.

### Options Considered

#### Option A: Combine all migrations into single task

- **Pros**: Eliminates mutual exclusion delays, atomic changes
- **Cons**: Single point of failure, difficult rollback, violates task boundaries
- **Impact**: Saves 8 hours on critical path
- **Risk**: High - all-or-nothing deployment

#### Option B: Sequence by logical dependencies (SELECTED)

- **Pros**: Granular rollback, clear ownership, safer deployment
- **Cons**: Adds 8 hours to critical path
- **Order**: auth → users → analytics → reporting
- **Risk**: Low - incremental changes

#### Option C: Implement migration queuing system

- **Pros**: Automatic conflict resolution, reusable infrastructure
- **Cons**: 16 hours implementation overhead
- **Break-even**: 3+ projects
- **Risk**: Medium - new complexity

### Rationale

Safety and maintainability outweigh time cost:

- Each feature team owns their migration
- Rollback capability crucial for production
- 8-hour delay acceptable for risk reduction

### Implementation Notes

- Enforce order via mutual_exclusion dependencies
- Each migration includes rollback script
- Test migrations on copy of production schema
- Use database_migrations resource lock

---

## Decision 4: Test Database Pool Management

### Context

15 tasks require integration testing with 3 database instances available.

### Options Considered

#### Option A: Expand pool to 5 instances

- **Pros**: Better parallelization, reduced wait times
- **Cons**: $200/month additional cost, setup complexity
- **Impact**: Reduces execution by 3 hours
- **ROI**: Negative for single project

#### Option B: Time-share existing 3 instances (SELECTED)

- **Pros**: No infrastructure changes, zero additional cost
- **Cons**: Some task waiting, complexity in scheduling
- **Impact**: Adds 1-2 hours average wait time
- **Utilization**: 60% average, 100% peak

#### Option C: Mock database for non-critical tests

- **Pros**: Unlimited parallelization for unit tests
- **Cons**: Less confidence, integration issues possible
- **Impact**: Reduces database load by 40%
- **Risk**: Medium - false positives possible

### Rationale

Current capacity sufficient with smart scheduling:

- 60% average utilization acceptable
- Peak usage brief (Wave 3 only)
- Coordinator handles scheduling complexity
- Can revisit if pattern continues

### Implementation Notes

- Group compatible tests in same wave
- Implement test data isolation
- Use transactions for cleanup
- Monitor wait times for future decisions

---

## Decision 5: Shared Resource Handling

### Context

Multiple shared resources create execution constraints.

### Options Considered

#### Option A: Ignore in planning, handle at runtime

- **Pros**: Simpler planning phase
- **Cons**: Runtime conflicts, unpredictable delays
- **Risk**: High - resource deadlocks possible

#### Option B: Model as mutex dependencies (SELECTED)

- **Pros**: Explicit constraints, no runtime surprises
- **Cons**: Additional edges in DAG, planning complexity
- **Impact**: 12 mutual exclusion edges added

#### Option C: Resource reservation system

- **Pros**: Optimal resource allocation
- **Cons**: Complex implementation, overhead
- **Effort**: 20+ hours to implement

### Rationale

Explicit modeling prevents runtime issues:

- Mutual exclusion edges have confidence=1.0
- Coordinator enforces constraints
- No surprises during execution
- Clear in planning artifacts

### Implementation Notes

- Document all shared resources in meta
- Create mutual_exclusion edges between conflicting tasks
- Set suggested ordering based on logical flow
- Monitor resource utilization for optimization

---

## Decision 6: Checkpoint Strategy

### Context

Need failure recovery without full task restart.

### Options Considered

#### Option A: No checkpoints, restart on failure

- **Pros**: Simple implementation
- **Cons**: Lost work, longer recovery
- **Impact**: Average 3h lost work per failure

#### Option B: Checkpoint at 25%, 50%, 75% (SELECTED)

- **Pros**: Bounded work loss, clear progress tracking
- **Cons**: Checkpoint overhead, storage needs
- **Impact**: Max 25% work loss, 5% overhead

#### Option C: Continuous checkpointing

- **Pros**: Minimal work loss
- **Cons**: High overhead (15-20%), complexity
- **Impact**: Near-zero work loss

### Rationale

Balanced approach with acceptable overhead:

- 5% overhead acceptable for recovery capability
- Standard percentages easy to implement
- Sufficient granularity for most tasks
- Storage requirements modest

### Implementation Notes

- Tasks declare checkpoint_capable flag
- Checkpoints store state + artifacts
- Coordinator tracks checkpoint registry
- Cleanup old checkpoints after task completion

---

## Decision 7: Worker Specialization

### Context

Tasks require different skill sets and tools.

### Options Considered

#### Option A: Generic workers handle all tasks

- **Pros**: Simple worker pool, any worker can take any task
- **Cons**: Tool installation overhead, context switching
- **Efficiency**: 60% due to setup time

#### Option B: Specialized workers (SELECTED)

- **Pros**: Pre-configured environments, faster execution
- **Cons**: May have idle specialists
- **Efficiency**: 85% with proper scheduling
- **Types**: backend, frontend, database, testing

#### Option C: Hybrid pool with cross-training

- **Pros**: Flexibility with specialization
- **Cons**: Complex capability matrix
- **Efficiency**: 75% average

### Rationale

Specialization worth the complexity:

- 25% efficiency gain significant
- Coordinator handles assignment complexity
- Workers declare capabilities
- Can add generic workers if needed

### Implementation Notes

- Workers announce capabilities on registration
- Coordinator matches tasks to workers
- Prefer specialized when available
- Fall back to generic if queues build

---

## Key Design Principles Applied

1. **Explicit over Implicit**: All constraints modeled in dependencies
2. **Safety over Speed**: When in doubt, choose safer option
3. **Reuse over Rewrite**: 47% code reuse target achieved
4. **Measurable Everything**: All tasks have acceptance criteria
5. **Gradual Rollout**: Checkpoints and rollback capabilities
6. **Resource Awareness**: Bottlenecks identified and mitigated
7. **Adaptive Execution**: Rolling frontier with backpressure
```

## Algorithm

### Phase 1: Codebase & Resource Analysis

1. **Scan existing codebase** using ast-grep patterns:

   ```javascript
   // Find existing APIs and interfaces
   ast-grep --pattern 'class $_ implements $_'
   ast-grep --pattern 'interface $_'
   ast-grep --pattern 'extends $_'

   // Find shared resources
   ast-grep --pattern 'class $_ < ActiveRecord::Migration'
   ast-grep --pattern 'deploy:' --lang yaml
   ast-grep --pattern 'ENV[$_]'
   ```

2. **Identify shared resources** that create constraints:
   - Database migration tools (exclusive)
   - Deployment pipelines (exclusive)
   - Test environments (limited capacity)
   - Configuration files (concurrent modification)

3. **Document findings** in tasks.json.meta.codebase_analysis

### Phase 2: Feature Extraction

Extract 5-25 features from PLAN_DOC:

- User-visible capabilities
- Infrastructure components
- Each with title, description, priority, and evidence

### Phase 3: Task Breakdown with Boundaries

For each feature, create tasks with:

- **Expected complexity** in measurable units
- **Clear completion criteria** with "stop_when" guidance
- **Explicit scope boundaries** (includes/excludes)
- **Resource requirements** (CPU, memory, exclusive resources)
- **Execution guidance** with logging instructions
- **Reuse mapping** to existing components

Auto-normalize: Split if >16h, merge if <0.5h

### Phase 4: Dependency Discovery

Classify dependencies:

1. **Technical**: Interface/artifact requirements
2. **Sequential**: Information flow
3. **Infrastructure**: Environment prerequisites
4. **Knowledge**: Learning requirements
5. **Mutual_Exclusion**: Shared exclusive resources
6. **Resource_Limited**: Limited capacity resources

### Phase 5: Resource Conflict Resolution

1. **Identify conflicts**: Tasks requiring same exclusive resources
2. **Create mutual exclusion edges** with confidence=1.0
3. **Document resolution strategy**:
   - Sequential ordering for exclusives
   - Wave separation for conflicts
   - Capacity planning for limited resources

### Phase 6: DAG Construction

1. **Filter edges**: Include only (confidence ≥ MIN_CONFIDENCE AND isHard=true)
2. **Cycle detection**: Max 2 resolution attempts
3. **Transitive reduction**: Remove redundant edges
4. **Calculate metrics**: Including resource utilization impact

### Phase 7: Dual Execution Model Generation

#### Wave-Based Generation

1. Use Kahn's algorithm for layering
2. Apply MAX_WAVE_SIZE constraint
3. Respect resource exclusions
4. Calculate wave estimates (P50/P80/P95)

#### Rolling Frontier Configuration

1. Identify initial frontier (zero in-degree nodes)
2. Simulate execution timeline
3. Calculate resource utilization
4. Generate coordinator configuration

### Phase 8: Documentation Generation

1. **Plan.md**: Both execution strategies with trade-offs
2. **Decisions.md**: Design choices with alternatives
3. **coordinator.json**: Rolling frontier orchestration config

## Validation Rules

### Hard Fails (Auto-Reject)

1. Cycles present in DAG
2. Resource edges without mutex type
3. Missing task boundaries (complexity, done, scope, logging)
4. < 50% tasks with duration estimates
5. No evidence on tasks/dependencies
6. No machine-verifiable acceptance checks
7. Secrets exposed in evidence quotes
8. Missing codebase analysis

### Quality Metrics

- Edge density: 0.05-0.5 (warn outside range)
- Verb-first naming: ≥80% compliance
- Evidence coverage: ≥95%
- Codebase reuse: Track and report percentage
- Resource conflicts: Must have resolution strategy

## System Prompt

```
You are T.A.S.K.S v3, a comprehensive planning engine supporting both wave-based and rolling frontier execution models.

CRITICAL REQUIREMENTS:
1. Research existing codebase with ast-grep BEFORE planning
2. Define boundaries for EVERY task: complexity, done criteria, scope, logging
3. Identify shared resources creating mutual exclusions
4. Generate BOTH execution models (waves and rolling frontier)
5. Document all design decisions with alternatives

TASK BOUNDARIES MUST INCLUDE:
- expected_complexity: Quantifiable (LoC, functions, endpoints)
- definition_of_done: Clear stop criteria with "stop_when"
- scope: Explicit includes/excludes paths
- execution_guidance: Detailed logging instructions

RESOURCE HANDLING:
- Identify exclusive resources (migrations, deployments)
- Model as mutual_exclusion dependencies
- Document resolution strategies
- Calculate serialization impact

OUTPUT EXACTLY THESE FILES:
1. features.json
2. tasks.json (with boundaries and resources)
3. dag.json (with resource metrics)
4. waves.json (both execution models)
5. coordinator.json (rolling frontier config)
6. Plan.md (with codebase analysis)
7. Decisions.md (with alternatives)

Use content hashing for deterministic output.
Redact secrets with [REDACTED].
Target 2-8h tasks (16h max).
Apply MIN_CONFIDENCE threshold.
```

## Command Interface

### Two-Phase Execution Model

T.A.S.K.S. operates in two distinct phases: **Planning** and **Execution**. This separation allows for plan review, modification, and approval before execution begins.

### Phase 1: Generate Execution Plan

```bash
tasks plan "<description>" [options]
```

Analyzes the codebase and generates a comprehensive execution plan with all artifacts.

**Examples:**

```bash
# Basic usage with defaults
tasks plan "Build a TODO list application"

# With custom codebase path and conservative confidence
tasks plan "Implement OAuth2 authentication" --codebase-path ./backend --min-confidence 0.9

# Wave-based execution for phased rollout
tasks plan "Migrate database to PostgreSQL" --execution-model wave_based --max-wave-size 5

# Output to specific directory
tasks plan "Add real-time chat feature" --output-dir ./plans/chat-feature
```

**Output:**

- Generates artifacts in `--output-dir` (default: `./tasks_output/`)
- Returns path to plan directory on success
- Exit code 0 on success, non-zero on failure

### Phase 2: Execute Plan

```bash
tasks execute <plan-path> [options]
```

Executes a previously generated plan using the specified execution model.

**Examples:**

```bash
# Execute most recent plan
tasks execute ./tasks_output/

# Execute specific plan with custom worker pool
tasks execute ./plans/chat-feature --worker-min 4 --worker-max 12

# Dry run to validate execution without making changes
tasks execute ./tasks_output/ --dry-run

# Execute with checkpoint recovery from previous failure
tasks execute ./tasks_output/ --resume-from-checkpoint

# Override execution model from plan
tasks execute ./tasks_output/ --force-execution-model wave_based
```

### Pipeline Usage

Plans can be generated and immediately executed using pipes:

```bash
# Generate and execute in one command
tasks plan "Build TODO app" | tasks execute -

# With full options
tasks plan "Implement payment system" \
  --codebase-path ./src \
  --min-confidence 0.85 \
  --execution-model rolling_frontier | \
tasks execute - \
  --worker-max 10 \
  --cpu-threshold 75
```

### Interactive Mode

```bash
# Interactive planning with review
tasks plan "Build TODO app" --interactive

# This will:
# 1. Analyze codebase
# 2. Generate initial plan
# 3. Open Plan.md for review
# 4. Prompt: "Review plan? [approve/edit/regenerate/abort]"
# 5. If approved, optionally start execution
```

### Plan Management Commands

```bash
# List all generated plans
tasks list-plans

# Show plan summary without full artifacts
tasks show-plan ./tasks_output/

# Validate plan without execution
tasks validate-plan ./tasks_output/

# Compare two plans
tasks diff-plan ./plans/v1/ ./plans/v2/

# Archive completed plan
tasks archive-plan ./tasks_output/ --tag "v1.0-release"
```

## Command Arguments

### `tasks plan` Arguments

| Argument            | Short | Example                        | Default          | Description                                       |
| ------------------- | ----- | ------------------------------ | ---------------- | ------------------------------------------------- |
| `<description>`     | -     | `"Build TODO app"`             | Required         | Natural language description of what to build     |
| `--min-confidence`  | `-c`  | `--min-confidence 0.85`        | 0.7              | Minimum confidence for DAG dependencies           |
| `--max-wave-size`   | `-w`  | `--max-wave-size 20`           | 30               | Maximum tasks per wave                            |
| `--codebase-path`   | `-p`  | `--codebase-path ./src`        | ./               | Root directory for analysis                       |
| `--execution-model` | `-m`  | `--execution-model wave_based` | rolling_frontier | Execution strategy                                |
| `--max-concurrent`  | `-j`  | `--max-concurrent 5`           | 10               | Max concurrent tasks (rolling frontier)           |
| `--output-dir`      | `-o`  | `--output-dir ./plans/`        | ./tasks_output/  | Output directory for artifacts                    |
| `--plan-doc`        | `-f`  | `--plan-doc spec.md`           | -                | Use external spec document instead of description |
| `--verbose`         | `-v`  | `--verbose`                    | false            | Verbose output                                    |
| `--interactive`     | `-i`  | `--interactive`                | false            | Interactive mode with review                      |

### `tasks execute` Arguments

| Argument                   | Short | Example                              | Default          | Description                             |
| -------------------------- | ----- | ------------------------------------ | ---------------- | --------------------------------------- |
| `<plan-path>`              | -     | `./tasks_output/`                    | Required         | Path to plan directory or `-` for stdin |
| `--worker-min`             | -     | `--worker-min 2`                     | 2                | Minimum worker pool size                |
| `--worker-max`             | -     | `--worker-max 12`                    | 8                | Maximum worker pool size                |
| `--cpu-threshold`          | -     | `--cpu-threshold 75`                 | 80               | CPU backpressure threshold (%)          |
| `--memory-threshold`       | -     | `--memory-threshold 90`              | 85               | Memory backpressure threshold (%)       |
| `--checkpoint-interval`    | -     | `--checkpoint-interval 20`           | 25               | Checkpoint interval (%)                 |
| `--resume-from-checkpoint` | `-r`  | `--resume`                           | false            | Resume from last checkpoint             |
| `--force-execution-model`  | -     | `--force-execution-model wave_based` | Use plan's model | Override execution model                |
| `--dry-run`                | `-d`  | `--dry-run`                          | false            | Validate without executing              |
| `--verbose`                | `-v`  | `--verbose`                          | false            | Verbose execution logs                  |
| `--metrics-port`           | -     | `--metrics-port 9090`                | -                | Prometheus metrics endpoint             |

## Environment Variables

Both commands respect environment variables for defaults:

```bash
export TASKS_CODEBASE_PATH=/workspace/myproject
export TASKS_EXECUTION_MODEL=wave_based
export TASKS_OUTPUT_DIR=/tmp/tasks
export TASKS_WORKER_MAX=16

# Now commands use these defaults
tasks plan "Add new feature"  # Uses env var defaults
```

## File Structure

A generated plan directory contains:

```
tasks_output/
├── features.json          # High-level features
├── tasks.json            # Task definitions with boundaries
├── dag.json              # Dependency graph
├── waves.json            # Execution strategies
├── coordinator.json      # Rolling frontier config
├── Plan.md              # Human-readable plan
├── Decisions.md         # Design decisions
├── .tasks-meta.json     # Metadata (timestamps, version, hash)
└── checkpoints/         # Execution checkpoints (created during execute)
    ├── P1.T001.checkpoint
    └── P1.T002.checkpoint
```

## Exit Codes

| Code | Meaning                            | Phase   |
| ---- | ---------------------------------- | ------- |
| 0    | Success                            | Both    |
| 1    | Invalid arguments                  | Both    |
| 2    | Codebase analysis failed           | Plan    |
| 3    | Cyclic dependencies detected       | Plan    |
| 4    | Resource conflicts unresolvable    | Plan    |
| 5    | Plan validation failed             | Execute |
| 6    | Worker pool initialization failed  | Execute |
| 7    | Execution failed (with checkpoint) | Execute |
| 8    | Execution failed (no checkpoint)   | Execute |
| 9    | User abort                         | Both    |

## Examples

### Simple Project

```bash
tasks plan "Create REST API for user management" \
  --codebase-path ./api \
  --output-dir ./plans/user-api

tasks execute ./plans/user-api
```

### Complex Migration

```bash
tasks plan "Migrate from MongoDB to PostgreSQL" \
  --min-confidence 0.9 \
  --execution-model wave_based \
  --max-wave-size 3 \
  --output-dir ./migration-plan

# Review plan
cat ./migration-plan/Plan.md

# Execute with careful resource management
tasks execute ./migration-plan \
  --worker-max 4 \
  --cpu-threshold 70 \
  --checkpoint-interval 10
```

### CI/CD Pipeline Integration

```bash
#!/bin/bash
# ci-deploy.sh

set -e

# Generate plan
PLAN_DIR=$(tasks plan "Deploy version ${VERSION}" \
  --plan-doc ./deployment-spec.md \
  --execution-model wave_based \
  --output-dir ./deploy-${VERSION})

# Validate plan
tasks validate-plan ${PLAN_DIR}

# Execute with monitoring
tasks execute ${PLAN_DIR} \
  --metrics-port 9090 \
  --dry-run

# If dry-run succeeds, execute for real
if [ $? -eq 0 ]; then
  tasks execute ${PLAN_DIR} \
    --metrics-port 9090
fi
```

This structure provides:

1. Clear separation between planning and execution
2. Flexibility to review/modify plans before execution
3. Pipeline compatibility for automation
4. Recovery capabilities with checkpoints
5. Both simple and advanced usage patterns
