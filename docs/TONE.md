# Tone of Voice

A short, opinionated style guide for the user-facing copy on a "pay me back" site. This is the voice that worked for the original campaign — feel free to swap your own in, but the underlying principles (warmth + low pressure + self-aware humour) are why people actually paid back instead of feeling cornered.

The text lives in two places: the per-token Astro pages (`src/components/Act*.astro`, `src/components/ModalitySelector.astro`, etc.) and the Telegram / email notifications (`worker/lib/notify-text.ts`).

## Address (form of "you")

**Always first name + casual "you".** The recipient list is friends and family — anything formal sounds wrong and cold.

- Correct: "Hey Max", "Hi Anna", "Hey Jonas"
- Wrong: "Dear Mr…", "Hello", "Dear customer"

(If you ship this in a language with a T/V distinction — German "du/Sie", French "tu/vous", Spanish "tú/usted" — use the informal form, always.)

## Greeting

The greeting skeleton mixes three building blocks: **self-deprecation + matter-of-fact framing + concrete numbers**.

> *"Hey Max — I know, I know. You're 1 of 9 people who still owe me a bit. In 38 days I'm leaving for a trip around the world, and 50 € would be a nice send-off."*

### Building blocks

1. **First name + an "I know, I know" beat** — disarms the awkwardness. You openly admit the situation is a little absurd.
2. **Matter-of-fact "1 of N" framing** — no pressure, just context. N is the length of your debtor list, generated dynamically.
3. **Concrete countdown + concrete amount** — days until the deadline and the actual amount. Clear, low-friction.

## CTA wording

Playful and functional. Never urgent or accusatory. Some examples that worked:

- "Send the money → PayPal"
- "Copy IBAN"
- "I've sent it"
- "Pay in installments"
- "I need a bit more time"

Colors: default tokens, nothing red or pulsing. CTAs are buttons with a clear verb, never imperatives like "Pay now!".

## Telegram / email notification

One line, short, useful. Default case (full payment):

> `💸 Max (50 €) — pay in full. Slider: 380 € → 330 €.`

For delays / installments: one extra line with the reason or plan.

> `🕓 Max (50 €) — needs more time. "Payday is the 15th, then it works."`

## Reply for "I need more time"

Sent to the debtor right after they self-confirm "I need more time": **warm, no pressure, no expectation**.

> *"All good, Max. I know. If something works out, just message me."*

## Post-deadline wording

After the deadline date, the page flips to a pixel-postcard look: "I've taken off — no stress". Payment options stay visible, but no slider, no countdown, no self-confirm.

> *"I've taken off — no stress. If you still want to pay, here:"*

Below: PayPal button + IBAN block + EPC-QR. Nothing else.

## DO

1. **Use first name + casual "you"** — always, no exceptions.
2. **Self-deprecation** — "I know, I know", "yes it's awkward, I know". Disarms the awkwardness of asking for money.
3. **Matter-of-fact "1 of N" framing** — takes the weight off the individual ("you're not the only one who still owes me").
4. **Concrete numbers** — amount in €, days until deadline. No vague language like "soon".
5. **Warm on delays** — no guilt-trip, no "shame". Just confirm you got their message.

## DON'T

1. **Never formal address** — the recipient list is friends and family, formal would be wrong and cold.
2. **Never "Last chance" / "Please pay"** — no pressure vocabulary. Playful-functional, never desperate.
3. **Never red or urgent colors** — no alarm look. Slider, CTAs, backgrounds stay in the default palette.
4. **Never passive-aggressive phrasing** — no "You still haven't…", no "Just reminding you again…". Friendship > money.
5. **Never show debtor names in the slider** — the slider only shows the combined open total. Who owes whom how much is private.

## Review

A two-person tone review before sending the links: get a review from someone who is NOT a debtor (risk mitigation against tone misfire). The reviewer checks the greeting + all backstories for:

- Does it still sound like you, or has it drifted?
- Would anyone feel personally attacked / lectured?
- Does the self-deprecation work, or does it tip into self-pity?
