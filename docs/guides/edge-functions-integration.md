# Edge Functions Integration Guide

This guide demonstrates how to use the D.A.T.A. CLI's Edge Functions capabilities alongside database migrations for a complete deployment workflow.

## Prerequisites

- D.A.T.A. CLI installed (`npm install -g @your-org/data-cli`)
- Supabase CLI installed (`npm install -g supabase`)
- Configured Supabase project

## Overview

The D.A.T.A. CLI seamlessly integrates Edge Functions deployment with database migrations, allowing you to:

- Deploy database changes and serverless functions in a single command
- Validate functions before deployment
- Maintain production safety with confirmation prompts
- Track deployment status through event-driven architecture

## Basic Commands

### 1. Function Management

```bash
# View available function commands
data functions --help

# Validate all Edge Functions
data functions validate

# Deploy specific functions
data functions deploy function-name-1 function-name-2

# Deploy all functions
data functions deploy

# Check deployment status
data functions status
```

### 2. Integrated Workflow

Deploy migrations and functions together:

```bash
# Compile SQL and deploy functions in one command
data db compile --deploy-functions

# Production deployment with safety confirmation
data --prod db compile --deploy-functions
```

## Project Structure

```
your-project/
├── sql/                    # SQL source files
│   ├── schemas/
│   ├── tables/
│   ├── functions/
│   └── policies/
├── functions/              # Edge Functions
│   ├── donations-webhook/
│   │   └── index.ts
│   ├── process-payment/
│   │   └── index.ts
│   └── send-receipt/
│       └── index.ts
├── migrations/             # Generated migrations
└── tests/                  # pgTAP tests
```

## Example Edge Functions

### Webhook Handler

```typescript
// functions/donations-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { donation_id, event_type } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  // Process webhook based on event type
  switch (event_type) {
    case 'donation.completed':
      // Update campaign totals
      await supabase.rpc('complete_donation', { 
        p_donation_id: donation_id 
      })
      break
    // ... other event types
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

### Payment Processor

```typescript
// functions/process-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const { amount, currency, donation_id } = await req.json()
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: { donation_id }
    })
    
    return new Response(JSON.stringify({ 
      client_secret: paymentIntent.client_secret 
    }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
})
```

## Deployment Workflow

### Development Environment

1. **Make database changes** in `sql/` directory
2. **Write Edge Functions** in `functions/` directory
3. **Compile and test locally**:
   ```bash
   # Compile SQL to migrations
   data db compile
   
   # Test migrations
   data db migrate test
   
   # Validate Edge Functions
   data functions validate
   ```

4. **Deploy to development**:
   ```bash
   # Deploy everything
   data db compile --deploy-functions
   ```

### Production Environment

1. **Review changes**:
   ```bash
   # Check migration status
   data db migrate status
   
   # Validate functions
   data functions validate
   ```

2. **Deploy with confirmation**:
   ```bash
   # Will prompt for confirmation
   data --prod db compile --deploy-functions
   ```

3. **Monitor deployment**:
   ```bash
   # Check function status
   data functions status
   
   # View deployment logs
   supabase functions logs function-name
   ```

## Event-Driven Architecture

The D.A.T.A. CLI emits comprehensive events during Edge Functions operations:

| Event | Description | Payload |
|-------|-------------|---------|
| `function-validated` | Function passed validation | `{ name, path }` |
| `function-deployed` | Function successfully deployed | `{ name, url }` |
| `deployment-complete` | All functions deployed | `{ total, successful, failed }` |
| `deployment-status` | Status check completed | `{ deployed: [...], local: [...] }` |

### Listening to Events

```javascript
// Custom reporter example
class FunctionDeployReporter {
  handleEvent(event) {
    switch (event.type) {
      case 'function-deployed':
        console.log(`✅ Deployed: ${event.data.name}`)
        console.log(`   URL: ${event.data.url}`)
        break
      case 'deployment-complete':
        console.log(`\n📊 Deployment Summary:`)
        console.log(`   Total: ${event.data.total}`)
        console.log(`   Success: ${event.data.successful}`)
        console.log(`   Failed: ${event.data.failed}`)
        break
    }
  }
}
```

## Production Safety Features

1. **Confirmation Prompts**: Production deployments require explicit confirmation
2. **Validation First**: Functions are validated before any deployment
3. **Import Map Checks**: Production requires import maps unless skipped with `--skip-import-map`
4. **Atomic Operations**: Migrations and functions deploy together or not at all
5. **Rollback Support**: Failed deployments can be rolled back

## Best Practices

### 1. Always Validate First
```bash
data functions validate && data functions deploy
```

### 2. Use Selective Deployment
Deploy only changed functions:
```bash
data functions deploy donations-webhook process-payment
```

### 3. Test in Staging
```bash
# Deploy to staging environment
DATA_ENV=staging data db compile --deploy-functions
```

### 4. Monitor Deployments
```bash
# Check status after deployment
data functions status

# View logs for debugging
supabase functions logs --tail
```

### 5. Version Control
- Commit Edge Functions alongside SQL changes
- Tag releases for production deployments
- Document function dependencies in README

## Troubleshooting

### Function Validation Fails
- Ensure Supabase CLI is installed: `npm install -g supabase`
- Check function TypeScript syntax
- Verify import statements use Deno URLs

### Deployment Timeout
- Increase timeout with environment variable: `DATA_DEPLOY_TIMEOUT=600`
- Check network connectivity to Supabase

### Import Map Issues
- Create `import_map.json` for production
- Or use `--skip-import-map` flag (not recommended)

### Function Not Found
- Verify function exists in `functions/` directory
- Check function name matches directory name
- Ensure `index.ts` exists in function directory

## Next Steps

1. **Set up your project structure** following the example above
2. **Configure environment variables** for Supabase access
3. **Write your first Edge Function** using the examples
4. **Test the integrated workflow** with `data db compile --deploy-functions`
5. **Deploy to production** when ready with proper safety checks

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [D.A.T.A. CLI Documentation](../README.md)
- [pgTAP Testing Guide](./pgtap-testing.md)
- [Migration Workflow Guide](./migration-workflow.md)