# The Riker Incident: A Cautionary Tale

## Stardate 47635.8 - Main Engineering

### 1437 Hours - The Setup

Commander William T. Riker strides into Engineering with the confidence of a man who once manually piloted a shuttle through an asteroid field blindfolded (Stardate 45832.1, but who's counting).

**Riker**: "Geordi, I need to update the poker tournament database. Just a quick change to add Worf's latest crushing defeat."

**Geordi**: "Commander, you'll need to use the D.A.T.A. system. It has safety protocols—"

**Riker**: "Safety protocols? Geordi, I've been updating databases since before Wesley was born. How hard can it be?"

### 1439 Hours - The Attempt

```bash
riker@enterprise:~$ vim sql/tables/poker_tournament.sql

# Riker adds:
# -- Worf lost again, surprising no one
# ALTER TABLE poker_games ADD COLUMN worf_bluff_failed BOOLEAN DEFAULT true;
```

**Riker**: "See? Easy. Now to deploy..."

```bash
riker@enterprise:~$ data align production --force

⚠️  WARNING: Commander, --force flag is not recognized.
   Perhaps you meant: data align production
   
   Note: There is no force. There is only logic.
```

**Riker**: "Computer, override safety protocols. Authorization Riker-Alpha-3."

```bash
🔴 RED ALERT: Nice try, Commander.

   This isn't the holodeck. You cannot simply override database safety.
   
   Detecting:
   - Uncommitted changes in working directory
   - No tests written for new column
   - Jazz music playing in background (regulation 47.2.1)
   
   Required actions:
   1. git add && git commit
   2. data test
   3. Turn off the jazz (optional but recommended)
```

### 1441 Hours - The Escalation

**Riker**: "Data! Your system won't let me deploy!"

**Data**: "That is correct, Commander. You have not followed proper procedures. The probability of success without testing is approximately—"

**Riker**: "I don't need probabilities, I need to update the poker database before tonight's game!"

**Data**: "Commander, may I assist?"

### 1443 Hours - Data's Intervention

```bash
data@enterprise:~$ git status

Changes not staged for commit:
  modified: sql/tables/poker_tournament.sql
  
Untracked files:
  riker_backup.sql
  riker_backup2.sql
  riker_backup_final.sql
  riker_backup_final_REAL.sql
  riker_backup_use_this_one.sql
```

**Data**: "Commander, you appear to have created multiple backup files. This suggests uncertainty in your approach."

**Riker**: "I like to keep my options open."

**Data**: "I see. Let me demonstrate the correct procedure."

```bash
# Data's precise approach
data@enterprise:~$ git add sql/tables/poker_tournament.sql
data@enterprise:~$ git commit -m "feat: Add Worf bluff tracking column

Per Commander Riker's request, adding column to track Worf's 
unsuccessful bluffing attempts. Statistical analysis shows a 
0% success rate over 47 games."

data@enterprise:~$ data test

Running database tests...
❌ FAILED: New column 'worf_bluff_failed' lacks:
   - NOT NULL constraint
   - Check constraint
   - Index for performance
   - RLS policy
   - Test coverage
   
Would you like me to generate the missing components? [Y/n]
```

### 1445 Hours - The Learning Moment

**Data**: "Commander, the system has identified several issues with your implementation."

**Riker**: "It's just a boolean column!"

**Data**: "Yes, however, a boolean column that could affect the morale of our Security Chief requires proper constraints. Additionally, Starfleet Regulation 276.3 requires all gambling-related data to be encrypted."

**Geordi** (laughing): "The system's got a point, Commander."

### 1447 Hours - The Proper Implementation

```bash
data@enterprise:~$ data generate migration --name add-worf-poker-tracking

Analyzing golden SQL...
Generating migration plan...

CREATE TABLE poker_statistics (
  player_id UUID REFERENCES crew(id),
  games_played INTEGER DEFAULT 0,
  bluffs_attempted INTEGER DEFAULT 0,
  bluffs_successful INTEGER DEFAULT 0,
  emotional_state_when_bluffing TEXT CHECK (
    emotional_state_when_bluffing IN ('stoic', 'very stoic', 'extremely stoic')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE poker_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own stats"
  ON poker_statistics
  FOR SELECT
  USING (player_id = current_user_id());

-- Grant Riker special access (he insists)
CREATE POLICY "First Officer override"
  ON poker_statistics
  FOR ALL
  USING (current_user_role() = 'first_officer');
```

### 1450 Hours - The Test Suite

```bash
data@enterprise:~$ data test

Running pgTAP tests...
✅ PASS: Table structure valid
✅ PASS: Constraints enforced
✅ PASS: RLS policies work correctly
✅ PASS: Worf cannot see other players' statistics
✅ PASS: Riker can see everything (as expected)
✅ PASS: Data cannot be emotional about poker

Coverage: 100%
All tests passed!
```

### 1452 Hours - The Successful Deployment

```bash
data@enterprise:~$ data promote
Tagged as: data/prod/47635.1452

data@enterprise:~$ data align production

🟢 All safety checks passed:
   ✓ Repository clean
   ✓ On main branch
   ✓ Tests passing (100%)
   ✓ No jazz music detected
   
Migration will:
   + CREATE TABLE poker_statistics
   + CREATE 2 RLS policies
   
Type 'ENGAGE' to proceed: ENGAGE

🎉 Deployment successful!
Time elapsed: 2.7 seconds
Disasters prevented: 1
Riker's ego: Slightly bruised but recovering
```

### 1455 Hours - The Aftermath

**Riker**: "That seemed like a lot of work for one column."

**Data**: "Commander, we have successfully prevented:
- Data corruption
- Security vulnerabilities  
- Worf discovering you track his bluffs
- 3.7 hours of debugging
- One potential court martial"

**Geordi**: "Plus, now it's all documented in git. We can see exactly when and why every change was made."

**Riker**: "Fine. But I still say the old way was faster."

**Worf** (entering): "Commander, I wish to review the poker statistics table structure."

**Riker**: "Uh, Data, can that RLS policy be made retroactive?"

**Data**: "I'm afraid not, Commander. The git history is immutable."

### 1500 Hours - Captain's Log Entry

**Captain Picard**: "Ship's log, supplemental. Commander Riker has learned what he calls 'a valuable lesson' about database deployment procedures. Mr. Data's system has prevented what could have been an embarrassing incident involving our Security Chief and statistical analysis of his poker face, or lack thereof. I have approved mandatory D.A.T.A. system training for all senior staff. Mr. Riker will be conducting the first session, as he now has, in his words, 'extensive experience with what not to do.'"

## Epilogue: That Evening's Poker Game

**Worf**: "Commander, I have analyzed the new poker statistics table."

**Riker** (sweating): "Oh?"

**Worf**: "It is... comprehensive. I appreciate the 'emotional_state_when_bluffing' column. It accurately reflects my Klingon stoicism."

**Data**: "The column only allows three values: 'stoic', 'very stoic', and 'extremely stoic'."

**Worf**: "As I said. Comprehensive."

**Troi** (sensing emotions): "Will, you're feeling relief mixed with... is that admiration for the D.A.T.A. system?"

**Riker**: "Let's just deal the cards."

---

## Lessons Learned

1. **Safety protocols exist for a reason** - Even experienced officers need guardrails
2. **Git history is forever** - Plan your commits accordingly
3. **Test coverage prevents wars** - Especially with Klingons
4. **Data (the android) was right** - Statistical probability: 99.97%
5. **Jazz music impairs judgment** - According to regulation 47.2.1

## Technical Takeaways

- Always use RLS policies for sensitive data
- Test coverage should be 100% for gambling-related tables
- Never name backup files with "final_REAL"
- The --force flag doesn't exist because force is not logical
- Worf's poker face has three states, all of them stoic

---

*"In poker, as in database deployments, the key is knowing when to fold."*  
— Commander William T. Riker, Stardate 47636.1