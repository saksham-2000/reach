# Reach

> *A game that only works if you talk to someone you don't know yet.*

Reach is a tiny daily ritual disguised as a game. Every morning, your college email gets you a number, a PIN, and a target. You can't reach the target alone — you have to ask other people for theirs.

The bridge isn't the app. The bridge is the five seconds where you walk up to a stranger and say, *"hey, weird question — what's your number today?"*

---

## How to play

**1. Sign in** with your college email. Each day you're assigned:

- **A value** — one number between 1 and 9. Yours for the day.
- **A PIN** — four digits, each 1–9. This is how other people "use" your value.
- **A target** — the score you're trying to reach today.
- **A starting score** — 0 if you're new, or yesterday's target if your streak is alive.

**2. Find someone.** A classmate, a barista, the person next to you on the bus. Ask them for their value and PIN for the day.

**3. Use it.** Enter their value and PIN in your app, then choose **add** or **subtract**. Their value is now part of your score.

**4. Reach the target.** Hit it exactly and your streak survives into tomorrow — with a higher target waiting.

## The small rules

- You **cannot** use your own value. Growth doesn't come from yourself.
- The value and PIN must **both match** the same person's assignment for today. A wrong pair won't work — no guessing.
- Each PIN works once per day.
- Once you ask a person, you **can't ask them again for three days**. Go find someone new. That's the point.
- Hit the target → streak **+1**. Miss or concede → streak **resets to 0**.
- Everything — your value, their value, every digit of every PIN — is between 1 and 9. On purpose. The game is not the math.

## What this isn't

It isn't a chatbot. It isn't a notification. It isn't a way to talk to people without talking to people.

It's an excuse. That's all you needed anyway.

---

## Running it

No build step. Open `index.html` in a browser.

```
reach/
├── index.html        # landing — sign in with email
├── play.html         # the game
├── css/
│   └── styles.css
├── js/
│   ├── identity.js   # deterministic daily assignment from email + date
│   ├── storage.js    # streak, score, used-pins (localStorage)
│   ├── landing.js    # sign-in flow
│   └── play.js       # game loop
└── README.md
```

State lives in `localStorage`, keyed by email. Clear it to start over.

## Honest caveats

This is a one-hour prototype. There is no server, no verification that the person you're "asking" is real, no way to stop two people from trading PINs over text instead of in person. That's the point — the game only works if you play it honestly. The code can't enforce a conversation. Only you can.
