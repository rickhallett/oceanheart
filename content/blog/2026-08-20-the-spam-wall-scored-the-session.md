+++
title = "The spam wall scored the session, not the keystrokes"
date = "2026-08-20"
description = "A job application was flagged as spam twice from a scratch browser profile, including my own manual click, then the identical content passed from my real, seasoned session."
tags = ["browser-automation", "agents", "spam-detection", "session-reputation", "human-ai-collaboration"]
aliases = ["/spam-wall/"]
draft = true

[build]
render = "always"
list = "always"
+++

I've been building a small experiment in machine-assisted form filling: an agent that fills real web forms using trusted browser input rather than JavaScript value injection. The distinction matters at the protocol level. Writing `el.value = "..."` and firing a synthetic event is what frameworks and fraud checks are built to notice; dispatching input through the browser's debugging protocol produces key events and clicks that are, as far as the page can tell, indistinguishable from a person at the keyboard. React accepts them. DOM-level trust checks accept them. That part of the design worked first time.

Then I submitted a real application through it, on one of the widely used applicant-tracking platforms, and the wall went up: the submission came back flagged as possible spam. No CAPTCHA challenge to solve, no error to correct. The form sat there intact, rejected.

Here's the observation that made the failure worth writing down. I clicked the submit button myself, by hand, in the same window. Flagged again. Same wall. A human finger on a real mouse, and the scorer didn't care.

That second flag ruled out the explanation I'd have reached for by default, which was that the machine's input had somehow been detected per-event. It hadn't. The session itself had already failed before either of us clicked. Consider what that session looked like from the platform's side: a fresh scratch profile with zero history, no cookies, no logins, an attached debugger, a headless origin, no mouse travel across the page, no scrolling, and two essays that each arrived as a single insert event, where a person would have produced several hundred keystrokes over ten minutes. Nothing about it resembled a person browsing. An invisible reputation scorer watches exactly this kind of thing, and it scores the session as a whole, whereas the trusted-input work I'd done operates on individual events. They're different layers. Winning at the event layer bought nothing at the session layer, and my manual click couldn't rescue a session that had already scored as a bot.

The password manager is the analogy that finally settled my thinking. Every time I log in anywhere, my password manager writes field values programmatically. So does browser autofill. Nobody's login gets spam-flagged for it, because those writes happen inside a genuine, seasoned session: months of history, a logged-in profile, a human who scrolled to the form and will click the button. So the provenance of the text was never the thing being scored. Machine-typed versus human-typed is the wrong axis entirely.

The axis that holds up is presence. Assisting a human who is genuinely there is one thing; fabricating the signals of a human who is absent is another. Autofill is the first. The dark-arts version of browser automation, the kind that injects synthetic mouse jitter and randomised inter-keystroke delays to convince a scorer that someone is home, is the second. I'd known about those techniques before this project started and had already decided not to build them; watching two flags land made the reasoning concrete.

So the project carries one permanent boundary: no code whose purpose is to fabricate human-interaction signals. I hold that line for three practical reasons. It deceives the third party, who is scoring sessions precisely because they want to know whether a person is present. It's a fragile arms race against opponents with more data and more incentive, and I'd lose it slowly and expensively. And it's unpublishable, which for a project whose whole point is an inspectable public artifact would destroy the thing I'm making. None of that feels like a sacrifice; evasion was never the problem I wanted to solve.

The hypothesis, on the other hand, was cheap to test. If the session was what failed, then the same content inside a real session should pass. I loaded the same form fresh in my actual Chrome, the seasoned, logged-in browser I use every day, and had the fill run there through an extension lane: same name, same links, same essays character for character, same selections. Then I reviewed the whole thing on screen, scrolled it, corrected nothing because nothing needed correcting, and clicked submit myself. It went straight through to the standard success screen.

One honest wrinkle: the transport differed between the failing and passing runs. The scratch-profile fills went through the raw debugger protocol; the real-browser fill went through an extension. The experiment tested the session, not the fill mechanism, and I can't fully separate the two variables from a single trial. Which is the larger caveat anyway: this is n=1, not a controlled test. Two flags and one pass, on one platform, on one day. I believe the session-reputation reading because it explains the manual-click failure and the autofill analogy predicts it, but a platform could change its scoring tomorrow and I'd have no instrument to notice.

Still, the architecture conclusion feels load-bearing enough to act on. The machine's mechanics belong inside a real human session, filling and parking a form for a person who is actually present to review it, with the submit remaining that person's own click on a third party's button. The headless debugger-port lane keeps a job too: it's the right tool for offline development against captured form fixtures, where there's no live endpoint and no session to score. Both lanes were right; the wall told me which job belongs to which.

What I keep returning to is that the right response to the reputation layer turned out to be no code at all: be a real human session, because a real human is in fact reviewing and submitting. The scorer is asking whether someone is present, and the honest answer was to make that true rather than to make it look true.
