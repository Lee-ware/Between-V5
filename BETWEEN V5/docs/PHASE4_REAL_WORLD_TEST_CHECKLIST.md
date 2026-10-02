# BETWEEN — Real-World Testing Checklist

This checklist is for people who **did not build BETWEEN**. Testers do not need to understand the code. The goal is to use the app naturally and deliberately try the situations below.

## Before testing

Use the release-candidate build on a **secondary/staging URL**, not production.

Recommended coverage:

- Android Chrome on at least two different phones if possible.
- One tester should install the PWA; another can use it in the browser.
- Test once with sound on and once with sound off.
- Test once with normal motion and once with **Reduced Motion** enabled on the device.
- Keep one clean install/test profile and one profile with existing history/data.
- Record the phone model, OS/browser version, and whether the app is installed as a PWA whenever something behaves strangely.

## 1. First launch / startup

- Open the app from a fresh browser tab.
- Close it completely and open it again.
- Reload it repeatedly.
- Open it after the phone has been asleep for a while.
- Confirm the startup screen finishes normally and does not hang.
- Confirm the avatar/logo and spinning rings load correctly.
- Confirm there is no artificial waiting screen.

## 2. Home and navigation

- Move between Home, Modes, Daily, Profile, and Settings.
- Use the app's Back controls.
- Use the **browser Back** button.
- Go forward again after browser Back.
- Open a mode, leave it halfway through, and return.
- Reload while on a screen.
- Confirm the app never traps you on a blank screen or old screen.

## 3. Pick One

Play several questions.

- Tap each side in different questions.
- Confirm the selected answer visibly locks.
- Confirm the next experience loads correctly.
- Try tapping twice very quickly.
- Try tapping where the other button was immediately after selecting.
- Confirm text never overlaps the buttons.

## 4. Knowledge

Play at least 10 questions across different topics.

- Answer correctly sometimes and incorrectly sometimes.
- Confirm the correct answer is identified after answering.
- Confirm the **explanation appears** and is readable.
- Confirm A/B/C/D ordering is correct.
- Try rapid repeated taps.
- Reload/leave after answering and confirm stats/history remain sensible.

## 5. Scenario

Play several different scenarios.

- Confirm the **scenario title** appears.
- Read the whole situation before choosing.
- Choose both A and B across different questions.
- Check long scenario text for clipping, accidental scrolling, or overlapping controls.
- Try very fast taps.

## 6. Estimation

Play both ordinary numeric estimates and range-based estimates.

For each:

- Enter a small number.
- Enter a large number.
- Use a decimal where appropriate.
- Submit once.
- Confirm the app shows your guess, the source answer, and the distance/feedback correctly.
- Check that ranges such as `A–B` are shown as ranges, not silently converted to an exact number.
- Test keyboard/number-entry behavior on a phone.
- Try submitting with the field empty.

## 7. Prediction

Test binary predictions and the special/numeric prediction interactions present in the release candidate.

- Make a prediction.
- Confirm the selection locks once.
- Confirm leaving and returning does not duplicate the prediction.
- Confirm the prediction is stored for later resolution.
- Confirm a later resolution/review can be understood without remembering the original screen.
- For personal predictions, confirm the app does not pretend it knows what happened when it cannot know.

## 8. Random

Play many Random cards in one sitting.

The important test is **variety**.

- Confirm Random is not just Pick One in disguise.
- Check open prompts.
- Check multi-option prompts.
- Check action/observation prompts.
- Check unusual punctuation, quotation marks, emoji/symbols, and multi-line prompts.
- Try repeatedly playing Random and watch for obvious repetition.

## 9. Brain

On the final release candidate, test each of the 20 player-facing Brain experiences below. These names are intentionally written for non-developer testers.

### 20 Brain experiences and what to look for

**1. Code Breaker** — find the target symbol in the grid.
- Confirm there is exactly one valid target.
- Tap the correct target quickly, then deliberately tap a wrong cell.
- Check that wrong taps affect the result without making the interface unusable.

**2. Memory Grid** — remember which cells were highlighted, then reproduce them.
- Confirm highlighted cells disappear before the answer stage.
- Confirm the same cells are reproducible and that impossible cell combinations never appear.

**3. Sequence** — remember and reproduce a sequence in the same order.
- Test numbers, letters/symbols where shown, and longer sequences at higher difficulty.
- Deliberately change one position and confirm the result reflects it.

**4. Reverse** — reproduce the shown sequence backwards.
- Confirm it is genuinely backwards, not the normal Sequence rule.

**5. Rule Switch** — follow a rule that changes during the run.
- Read the first rule, answer it, then verify the rule actually changes.
- Test a mistake immediately after the switch.

**6. Don’t Tap** — respond to allowed signals and avoid forbidden ones.
- Test both a correct “go” response and a forbidden “no-go” response.
- Try tapping rapidly during transitions.

**7. Odd One** — identify the one item that differs.
- Confirm there is one intended odd item, not multiple plausible answers.

**8. Change Detective** — compare two displays and find what changed.
- Confirm exactly one intended change exists.
- Check that the reported changed position matches what you saw.

**9. Flash Recall** — information appears briefly, then you answer a targeted question about it.
- Confirm the information disappears before the question.
- Test both an easy and a harder recall question.

**10. Where Was It?** — remember where an object was positioned.
- Confirm the target position is selectable and remains consistent with the shown scene.

**11. Path** — remember and reproduce a path through the grid.
- Confirm the path is contiguous and begins/ends where indicated.
- Try one wrong move and restart/retry normally.

**12. Sort It** — classify items according to the current rule.
- Confirm the left/right meaning is obvious.
- Test a rule change where one is presented.

**13. Number Trap** — answer a numerical task such as largest, smallest, closest, furthest, or a positional choice.
- Read the exact task before answering.
- Confirm the requested relationship changes at harder stages where designed.

**14. BETWEEN Code** — symbols secretly map to numbers.
- Confirm the mapping shown is internally consistent.
- At harder stages, verify a code update really replaces the previous mapping.

**15. Mirror** — identify the mirrored/rotated arrangement.
- Confirm the correct transformation is visually distinguishable.
- Check that asymmetric shapes do not produce two equally valid answers.

**16. The Next Thing** — complete a sequence or visual pattern.
- Confirm the pattern has one intended answer.
- Flag any round where multiple answers seem equally defensible.

**17. Rapid Sort** — classify rapidly under time pressure.
- Confirm the rule is visible before the rapid phase begins.
- Test missed items, quick correct responses, and a deliberate wrong response.

**18. Memory + Distraction** — remember information while a distractor/question appears.
- Confirm the distractor does not replace the information you are supposed to remember.
- Test a targeted recall question after the distraction.

**19. One Second** — briefly view a simple visual and answer the resulting count/recognition task.
- Confirm the flash duration feels intentional rather than broken.
- Check that larger counts/symbol sets remain readable and tappable.

**20. FINAL BOSS: BETWEEN** — a mixed Brain run combining memory, rules, sequence, change detection, code, switching, distraction, and a final visual challenge.
- Complete the entire run.
- Confirm each stage changes cleanly to the next.
- Confirm the final result includes the five game-performance dimensions without IQ/psychological claims.

### Brain-wide stress tests

Run these against several different Brain experiences, and at least once against a full run:

- Complete a normal run.
- Make mistakes deliberately.
- Tap too quickly.
- Double-tap.
- Tap immediately after time expires.
- Leave the Brain screen while a challenge is active.
- Press browser Back during an active challenge.
- Refresh during an active challenge.
- Start another Brain run immediately after one finishes.
- Confirm an old timer never submits a result into a new challenge.
- Confirm impossible/ambiguous generated challenges never appear.
- Check slow-device behavior where possible.
- Repeat a Daily Brain challenge and confirm the same daily challenge remains deterministic where the product says it should be.
- Turn Reduced Motion on and confirm animation changes without changing gameplay timing.
- Turn sound off and confirm Brain remains fully playable.

## 10. Surprise Me / mixed sessions

- Use Surprise Me repeatedly.
- Confirm modes actually change.
- Confirm the app does not get stuck serving the same mode.
- Confirm Brain appears only where intended.
- Confirm archived Majority does not appear as normal active gameplay.
- Confirm the session remains coherent when moving between very different experience types.

## 11. Daily

- Open Daily.
- Complete today's available experiences.
- Reload after completion.
- Confirm completed Daily items remain completed appropriately.
- Confirm the same day does not randomly produce a different deterministic Daily item after reload.
- Check the next-day boundary on a future test date when possible.

## 12. Profile / stats / history

- Complete several items from multiple modes.
- Open Profile.
- Confirm counts increase in the correct modes.
- Confirm Knowledge correctness changes only from Knowledge.
- Confirm neutral modes are not treated as objectively right/wrong.
- Check streak behavior after activity.
- Open history and verify recent experiences are recognizable.

## 13. Abandonment / recovery

During an active experience, deliberately:

- Leave using the app Back control.
- Press browser Back.
- Refresh.
- Close the tab/app.
- Reopen it.
- Start a different experience.
- Wait for a timer to expire.

Check that an abandoned experience never later submits a phantom answer or changes the wrong result.

## 14. Offline / reconnect / PWA

- Install the PWA.
- Launch it in standalone mode.
- Turn on Airplane Mode after the app shell has loaded/cached.
- Navigate through core content.
- Play experiences that do not require the network.
- Turn connectivity back on.
- Confirm the app recovers normally.
- Confirm optional crowd functionality does not break the rest of the app when unavailable.
- Close and reopen the installed PWA offline.

## 15. Backup / import / storage recovery

- Export a backup.
- Clear/reduce local data only on a disposable test profile.
- Import the backup.
- Confirm settings/history/progress are restored appropriately.
- Test a malformed JSON file.
- Test an invalid/unsupported backup.
- Confirm the app rejects bad files without corrupting existing data.

## 16. Sharing / links

Test every final sharing surface:

- Question sharing.
- Duel links.
- Pack/question links where enabled.
- Copy-to-clipboard.
- Native share sheet where the device supports it.

Check that a shared link does not expose malformed content or break because of quotation marks, apostrophes, emoji, spaces, or special characters.

## 17. Moments / Time Capsule / Pass the Phone / Question Lab

Where present in the final build:

- Save an item.
- Re-open it later.
- Remove it.
- Reload the app and confirm persistence.
- Pass the phone between people and return to the original user.
- Create/edit/import/export any supported custom pack.
- Confirm custom content cannot crash the app with long text or special characters.

## 18. Sound and Reduced Motion

Sound:

- Toggle sound off.
- Play multiple experiences.
- Confirm gameplay still works normally.
- Re-enable sound and check the change persists.

Reduced Motion:

- Enable Reduced Motion.
- Play timed Brain challenges.
- Confirm animations are reduced but **gameplay timing is not changed**.

## 19. Screen-size / touch checks

Test:

- Small phone.
- Larger phone.
- Portrait orientation.
- Any supported desktop/tablet layout.

Look for:

- clipped text
- buttons too small to tap comfortably
- controls off-screen
- horizontal scrolling where it should not exist
- content hidden behind browser/PWA UI
- accidental taps caused by elements shifting during transitions

## 20. Security / hostile-input sanity checks

These are normal tester actions, not code knowledge.

- Enter quotation marks in any user-editable field.
- Enter apostrophes.
- Enter `<` and `>` where text input is allowed.
- Paste long text.
- Open unusual/invalid share or pack links.
- Try malformed imported data.
- Confirm the app shows harmless text rather than executing or rendering unexpected HTML.

## 21. Final “use it like a stranger” test

Have a tester who has **not watched development** use BETWEEN for 15–30 minutes without being told what to click.

Do not explain the app's structure first.

Watch for:

- confusion about what a button does
- uncertainty about where to go next
- hesitation caused by unclear labels
- places where the tester thinks something is broken
- moments where they naturally want to replay
- moments where they stop because the flow feels repetitive

Record observations separately from actual bugs.

## Bug report template

When something fails, capture:

**Device:**

**OS / browser:**

**Installed PWA or browser tab:**

**What I was doing:**

**Exact steps to reproduce:**

**Expected:**

**Actual:**

**Did it happen more than once?**

**Screenshot/video:**

**Offline or online:**

**Sound / Reduced Motion state:**

## Result labels

Use only one of these when reporting:

- **BUG** — something is broken or behaves incorrectly.
- **USABILITY** — it works, but a normal person could reasonably struggle with it.
- **DEVICE-SPECIFIC** — works elsewhere but fails on a particular device/browser.
- **PREFERENCE** — personal taste, not a defect.
- **FUTURE IDEA** — useful improvement that does not block release.
