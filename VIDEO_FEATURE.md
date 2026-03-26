# Agent Video Recording Feature

## The Game Changer

Cursor agents **automatically record video** of their entire session. This is a built-in feature - you don't need to enable it.

## What Gets Recorded

The agent's video shows:
- ✅ All terminal commands executed
- ✅ kubectl outputs and responses
- ✅ File creation and editing
- ✅ The complete workflow from start to finish
- ✅ Any debugging or problem-solving the agent does

## Why This Makes Your Demo Better

### Before (Without Video)
You had to:
1. Screen record yourself
2. Capture the agent working
3. Edit out boring parts
4. Add voice-over
5. Hope the timing worked out

### After (With Agent's Video)
You just:
1. Run the agent once
2. Let it complete
3. Take the agent's video
4. Speed it up to fit 3 minutes
5. Add voice-over narration

**The agent's video IS your demo.**

## Updated Demo Flow

```
Your 3-Minute Demo:

00:00-00:30 | Intro slide + mock-ticket.json
            "Here's a Placement bug that would take 3 hours to reproduce..."

00:30-02:30 | Agent's video (sped up 2-3×)
            Voice-over: "Watch the autonomous agent work..."
            - Show cluster creation
            - Show resource deployment
            - Show bug validation

02:30-03:00 | Results slide + VALIDATION_REPORT.md
            "Bug confirmed in 8 minutes. Questions?"
```

## Agent Video as Evidence

The video serves multiple purposes:

**For Your Demo:**
- Visual proof of autonomous execution
- Shows the agent's decision-making process
- Professional quality (Cursor's recording is clean)

**For Engineering:**
- Reproducible evidence trail
- Exact commands executed
- Timing information (how long each step took)
- Debugging reference if test needs to be re-run

**For Leadership:**
- Compelling visual demonstration
- "Show, don't tell" proof of capability
- Quantifiable automation (video timestamp = time saved)

## Where to Find the Video

After the agent completes, look for:
- `agent-session.mp4` (or similar filename)
- In the same directory as your other generated files
- Check Cursor's agent artifacts panel

## Video Editing Tips

### 1. Speed It Up
```bash
# Use ffmpeg to speed up 2-3×
ffmpeg -i agent-session.mp4 -filter:v "setpts=0.4*PTS" agent-session-fast.mp4

# Or use QuickTime/iMovie to adjust playback speed
```

### 2. Add Highlights
- Overlay text pointing out key moments
- "← Creating kind cluster"
- "← Reproducing bug scenario"
- "← Bug confirmed!"

### 3. Picture-in-Picture
Show the agent's video + your face in corner (optional)
- Makes it more personal
- Shows you're narrating, not just playing a video

### 4. Bookend with Slides
- Opening slide: The problem statement
- Agent video: The solution in action
- Closing slide: The impact

## Fallback Plan

If for some reason the agent doesn't generate a video:

**Plan B:** Record your own screen while the agent works
- Still shows autonomous execution
- You have full control over the recording
- Can still add voice-over after

But according to Cursor's blog, video generation is a core feature, so this should work automatically.

## Example Narrative Over Agent's Video

As the video plays, you narrate:

> "The agent starts by reading the Jira ticket... parsing the bug description...
>
> Now it's provisioning a kind cluster - no human input needed...
>
> Installing Kubernetes Custom Resource Definitions for ACM...
>
> Creating the ManagedClusterSet 'test-set'...
>
> Deploying a Placement with the exact label selector from the ticket...
>
> And now - checking if the bug exists... capturing the Placement status...
>
> Bug confirmed. The status field is empty, exactly as reported.
>
> The agent captures evidence: YAML dumps, logs, full status...
>
> And generates this validation report..."

## The "Wow" Moment

When you show the video, the audience realizes:

**"That agent did ALL of that by itself?"**

That's when they understand the value. The video is visual proof that eliminates any skepticism.

---

**Key Takeaway:** The agent's video is your strongest asset. Build your demo around it.
