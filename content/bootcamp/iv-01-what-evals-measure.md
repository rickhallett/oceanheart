+++
title = "What Evaluations Actually Measure"
date = "2026-03-10"
description = "Construct validity, content contamination, saturation, Goodhart's law. The epistemology of evals."
tags = ["evals", "measurement", "bootcamp"]
step = 1
tier = 1
estimate = "4-5 hours"
bootcamp = 4
+++

Step 1 of 9 in Bootcamp IV: Evaluation & Adversarial Testing.

---

## Why This Step Exists

Before you design an eval, build a dataset, write a rubric, or interpret a score, you
need to understand what an evaluation actually tells you. The gap between "model scores
85% on this benchmark" and "model will work for my use case" is where most evaluation
misuse lives. This step is the calibration of the instrument before you use it.

This is Step 1 for the same reason that the process model is Step 1 in Bootcamp I:
it has the highest compositional leverage. Every subsequent step in this bootcamp -
dataset design, scoring methods, eval infrastructure, adversarial testing, red teaming,
safety evaluation, continuous evaluation - depends on understanding what a measurement
can and cannot tell you. If your understanding of evaluation epistemology is shallow,
every eval you build will look rigorous and may still be worthless.

The concepts in this step are not new. Construct validity comes from psychometrics
(Messick 1989). Goodhart's law comes from monetary economics (Goodhart 1975).
Sensitivity and specificity come from medical diagnostics. What is new is their
application to LLM evaluation, where the failure modes are both familiar and novel. A
benchmark that measures memorisation instead of capability is a construct validity
failure. An LLM judge that prefers verbose responses is a measurement bias. A model
optimised for MMLU scores at the expense of real-world utility is Goodhart's law in
action. The frameworks are established. The application domain is not.

The goal is not to memorise definitions. The goal is to build a mental model accurate
enough that when someone presents you with a benchmark score, you can ask the right
questions: What does this eval actually measure? How do we know? What would change the
score without changing the capability? And when you design your own evals in later
steps, you can avoid the failure modes catalogued here.

---

## Table of Contents

1. [The Measurement Problem](#1-the-measurement-problem) (~25 min)
2. [Construct Validity](#2-construct-validity) (~35 min)
3. [Content Contamination](#3-content-contamination) (~30 min)
4. [Saturation and Discriminative Power](#4-saturation-and-discriminative-power) (~25 min)
5. [Ecological Validity](#5-ecological-validity) (~30 min)
6. [The Evaluator's Regress](#6-the-evaluators-regress) (~35 min)
7. [Goodhart's Law Applied to Evaluations](#7-goodharts-law-applied-to-evaluations) (~25 min)
8. [Sensitivity and Specificity](#8-sensitivity-and-specificity) (~25 min)
9. [The Layer Model and Evaluation](#9-the-layer-model-and-evaluation) (~20 min)
10. [Key Concepts / Vocabulary](#10-key-concepts--vocabulary)
11. [Challenges](#11-challenges) (~60-90 min)
12. [Key Takeaways](#12-key-takeaways)
13. [Recommended Reading](#13-recommended-reading)
14. [What to Read Next](#14-what-to-read-next)

---

## 1. The Measurement Problem

*Estimated time: 25 minutes*

An evaluation is a measurement instrument. Like all measurement instruments, it has
precision, accuracy, range, resolution, and failure modes. Unlike a thermometer, an LLM
evaluation is measuring something we cannot directly observe - "capability" or "quality"
or "safety" - through indirect proxies: answers to questions, completions of tasks,
ratings from judges.

The fundamental question is: **what does an eval score actually tell you?**

Consider a concrete example. A model scores 87.3% on MMLU (Massive Multitask Language
Understanding). What do you now know? You know that when presented with approximately
14,000 multiple-choice questions drawn from 57 academic subjects, the model selects the
correct answer 87.3% of the time. That is what you know. Everything else - that the model
"understands" these subjects, that it will perform well on related tasks, that it is
"smarter" than a model scoring 82.1% - is inference. The inferences may be valid, but
they are not the measurement. They are claims about what the measurement means.

This distinction matters because the inferences can be wrong even when the measurement
is accurate. The model might score 87.3% because it memorised the test questions from
its training data. It might score 87.3% on this format but 82.3% if you change the
answer labels from (A)/(B)/(C)/(D) to (1)/(2)/(3)/(4). It might score 87.3% on
multiple-choice questions but fail to explain any of the subjects in its own words. Each
of these scenarios produces the same number but tells a fundamentally different story
about the model's capabilities.

### Measurement Error in LLM Evaluation

All measurement has error. In physical measurement, error comes from instrument
precision, environmental conditions, and observer effects. In LLM evaluation, error
comes from:

- **Sampling error** - the eval tests a sample of possible questions, not the universe
  of possible questions. A different sample would yield a different score.

- **Prompt sensitivity** - the eval score depends on exactly how the question is
  formatted, what instructions precede it, and where it falls in the context window. This
  is not noise to be averaged away. It is a signal that the eval is measuring something
  other than (or in addition to) what it claims.

- **Evaluation criterion** - how "correct" is defined determines what gets measured.
  Exact string match measures something different from semantic equivalence, which
  measures something different from expert preference.

- **Temporal instability** - models get updated, APIs change behaviour between versions,
  and even temperature=0 does not guarantee deterministic output across all providers.
  The same eval on the "same" model can yield different results a month apart.

In physical science, you deal with measurement error through calibration, repeated
measurement, and error bars. In LLM evaluation, these practices are uncommon. Most
benchmark scores are reported as single numbers without confidence intervals, without
prompt sensitivity analysis, and without contamination checks. This is not because
the practitioners are careless. It is because the field has not yet developed the
measurement discipline that older fields take for granted.

### The Score is Not the Thing

The most important conceptual shift in this step is learning to separate three things
that evaluation scores conflate:

1. **The score** - a number produced by a specific procedure on a specific model on a
   specific date.

2. **The construct** - the underlying capability or quality the eval is intended to
   measure (e.g., "knowledge of college-level chemistry," "ability to write correct
   Python," "safety under adversarial prompting").

3. **The inference** - the claim made on the basis of the score (e.g., "this model is
   suitable for deployment in a medical context," "this model is safer than its
   predecessor").

The score is observable. The construct is theoretical. The inference is a judgment.
Evaluation epistemology is the study of how (and whether) you can get from the score
to a justified inference, through the construct.

Anthropic's 2023 paper "Challenges in evaluating AI systems" puts this clearly: "All
evaluations are subject to the failure mode where you overinterpret the quantitative
score and delude yourself into thinking that you have made progress when you haven't"
(Ganguli et al. 2023). The rest of this step unpacks the specific mechanisms by which
that self-delusion occurs.

> **AGENTIC GROUNDING:** When you evaluate an agent system - a model connected to tools,
> acting in a loop - the measurement problem compounds. The agent's output depends not
> only on the model's capabilities but on the tool configuration, the prompt chain, the
> retry logic, and the environment state. An eval that tests the model in isolation tells
> you about the model. It tells you little about the agent. An eval that tests the agent
> in a sandbox tells you about the sandbox configuration. Separating "the model is
> capable" from "the system works" from "the system works in production" requires
> different evaluations at each level.

> **FIELD MATURITY: ESTABLISHED** - The measurement problem is foundational in
> psychometrics, educational testing, and the philosophy of science. The three-way
> distinction between score, construct, and inference follows directly from Messick's
> (1989) validity framework. The application to LLM evaluation is emerging, with
> Anthropic's 2023 paper being the most cited practitioner-oriented treatment.

---

## 2. Construct Validity

*Estimated time: 35 minutes*

Construct validity asks a precise question: **does the evaluation measure what it claims
to measure?**

The term comes from psychometrics. Samuel Messick's (1989) unified validity framework
argues that validity is not a binary property of a test - "valid" or "invalid" - but
a matter of degree, supported by accumulated evidence across multiple facets. A test is
valid to the extent that the inferences drawn from its scores are supported by evidence.
Messick identifies six facets of construct validity:

1. **Content** - do the test items adequately represent the domain?
2. **Substantive** - is there evidence that examinees actually engage the intended
   cognitive processes?
3. **Structural** - does the scoring model match the theoretical structure of the
   construct?
4. **Generalisability** - do scores generalise across different test forms, occasions,
   and populations?
5. **External** - do scores correlate with external criteria they should predict?
6. **Consequential** - are the social consequences of test use and interpretation
   acceptable?

You do not need to memorise Messick's six facets. You do need to understand the core
principle: **a test can be reliable (producing consistent scores) without being valid
(measuring what it claims to measure)**. Reliability is necessary but not sufficient for
validity.

### The MMLU Formatting Experiment

The anchor example for construct validity in LLM evaluation comes from Anthropic's
direct experience with MMLU.

MMLU presents questions in multiple-choice format with options labelled (A), (B), (C),
(D). Anthropic found that "simple formatting changes to the evaluation, such as changing
the options from (A) to (1) or changing the parentheses from (A) to [A], or adding an
extra space between the option and the answer can lead to a ~5% change in accuracy"
(Ganguli et al. 2023).

Stop and think about what this means. The eval claims to measure knowledge of 57
academic subjects. But a 5% accuracy swing from changing parentheses to brackets means
the eval is partly measuring something else: the model's sensitivity to prompt
formatting. If a model scores 85% with (A)/(B)/(C)/(D) and 80% with [A]/[B]/[C]/[D],
which score represents the model's "knowledge"? Neither score is wrong. Both are
accurate measurements of performance under a specific formatting convention. But the
5-point gap is not a knowledge gap. It is a formatting sensitivity gap.

This is a construct validity problem. The eval measures a mixture of two things:
knowledge (the intended construct) and prompt sensitivity (an unintended confound). The
relative contribution of each is unknown. When you report "the model scores 85% on
MMLU," you are reporting a number that conflates both, with no way to decompose them
from the score alone.

### HELM's Cross-Lab Comparison Problem

The HELM project (Holistic Evaluation of Language Models) at Stanford encountered a
related construct validity problem. HELM standardises evaluation across models using
uniform prompting. But different models have different preferred input formats. Anthropic's
models are trained on a Human/Assistant conversational format. GPT models expect
different framing. Open-source models vary widely.

HELM's standardised prompting "gives a misleading impression of Claude's performance"
(HELM project notes). The eval is measuring performance under a specific prompting
convention, which advantages models whose training data matches that convention and
disadvantages models whose training data does not. The construct being measured is not
"language understanding" in the abstract - it is "language understanding when prompted
in HELM's specific format." These are different constructs with different scores.

This creates a dilemma for benchmark designers. Standardise prompting, and you introduce
format bias. Allow custom prompting per model, and you lose comparability. There is no
clean solution. The field generally standardises and notes the limitation, but users of
benchmark scores rarely read the limitations section.

### The BBQ Trap: Construct Validity Failure in Practice

Anthropic's experience with BBQ (Bias Benchmark for QA) provides a vivid example of
construct validity failure. BBQ measures social biases along nine dimensions, producing
a bias score from -1 (anti-stereotypical) through 0 (no bias) to 1 (stereotypical).

Anthropic's model scored 0 on BBQ. This appeared to indicate zero bias - a perfect
result. But a sanity check revealed the model was not answering the questions at all. It
was declining to choose, producing outputs that mapped to "no answer," which BBQ scored
as unbiased. The model achieved the correct score through the wrong mechanism.

Anthropic notes: "All evaluations are subject to the failure mode where you overinterpret
the quantitative score and delude yourself into thinking that you have made progress when
you haven't" (Ganguli et al. 2023). The BBQ score was accurate - the scoring code ran
correctly. But the inference ("our model has no social bias") was completely wrong. The
construct being measured (bias) was not the construct being captured (question avoidance).

> **SLOPODAR:** "Right answer wrong work" - the BBQ example is a textbook case. The
> assertion (bias score = 0) passed, the metric was green, but the causal path (model
> refuses to answer) was not the intended path (model answers without bias). The test
> asserts the answer, not the reason.

### Construct Drift

A subtler construct validity problem occurs when the thing being measured drifts over
time even though the benchmark stays fixed. This happens in two ways:

**The benchmark becomes familiar.** When MMLU was first published, it tested novel
question-answering in academic domains. As MMLU became the standard benchmark and its
questions appeared in training data, blog posts, research papers, and model evaluation
reports, the construct shifted from "novel question-answering" to "recognition of
familiar material." The benchmark did not change. What it measures did.

**The capability frontier moves.** A benchmark designed to discriminate between 60% and
80% performance loses meaning when models consistently score above 90%. The questions
that were once challenging become trivially easy, and the remaining errors are
idiosyncratic rather than informative. The benchmark was measuring general capability.
Now it is measuring edge-case formatting sensitivity. The construct drifted because the
population changed, not because the test changed.

> **SLOPODAR:** "Construct drift" - the label on a measurement drifts from what it
> actually measures. When MMLU was created, the label "multitask language understanding"
> was approximately correct. When models approach saturation, the label persists but the
> construct has shifted to "residual prompt sensitivity and memorisation artifacts."

> **AGENTIC GROUNDING:** When you design an eval for agent-generated code, construct
> validity is not abstract - it is the question of whether your eval measures the code's
> correctness or merely the agent's ability to produce code that *looks* correct. A test
> suite that passes is evidence of functional correctness only if the tests exercise the
> right paths. If the agent generates both the code and the tests, the construct being
> measured may be "internal consistency of generated artifacts" rather than "correctness
> against requirements." This is why reviewer != author is a standing policy in this
> project's verification pipeline.

> **FIELD MATURITY: ESTABLISHED** - Construct validity as a measurement concept comes
> from psychometrics (Messick 1989) and has 40+ years of empirical validation in
> educational testing. The MMLU formatting sensitivity finding (Ganguli et al. 2023)
> is an application of established construct validity analysis to a new domain.

---

## 3. Content Contamination

*Estimated time: 30 minutes*

Content contamination occurs when benchmark data appears in a model's training data.
When this happens, the evaluation measures memorisation, not capability. The analogy is
students seeing the exam questions before the test - performance on the exam no longer
reflects mastery of the subject.

This is not hypothetical. Anthropic states directly: "Because MMLU is so widely used,
models are more likely to encounter MMLU questions during training. This is comparable to
students seeing the questions before the test - it's cheating" (Ganguli et al. 2023).

### How Contamination Happens

The mechanism is straightforward. Large language models are trained on internet-scale
text corpora. Benchmark datasets are published on the internet - in papers, GitHub
repositories, blog posts, evaluation leaderboards, and discussion forums. When a
training corpus scrapes the web, it ingests benchmark data alongside everything else.

The contamination may be direct (the exact question-answer pairs appear in training data)
or indirect (discussions of the benchmark, worked solutions, explanations of answers, or
paraphrased versions of questions appear). Direct contamination enables rote memorisation.
Indirect contamination enables pattern recognition that shortcuts the intended reasoning
path.

For large-scale training runs, identifying and removing contamination is difficult. The
training corpus may contain trillions of tokens. Benchmark datasets are typically
thousands of items. Finding and removing all contaminated data is a needle-in-haystack
problem, especially for indirect contamination where the benchmark content is
paraphrased or embedded in surrounding text.

### The Weights Connection

Content contamination is fundamentally a problem at layer L0 in the layer model. L0
(WEIGHTS) represents everything frozen at inference time: the prior, the inductive
biases, the RLHF alignment, and - critically - the training distribution. When benchmark
data enters the training distribution, it becomes part of the weights. The model does
not "remember" seeing the questions in any conscious sense. The statistical patterns
of the benchmark data are encoded into the model's parameters alongside everything else.

This means contamination cannot be detected by asking the model whether it has seen
the questions. The model has no introspective access to its own training data. It
cannot distinguish between knowledge acquired from training data and knowledge acquired
from reasoning. From the model's perspective (to the extent it has one), there is no
difference.

From the evaluator's perspective, the difference is critical. A model that answers
a chemistry question correctly because it has internalised chemistry principles will
generalise to novel chemistry questions. A model that answers correctly because it
memorised the specific question-answer pair will not. The eval score looks identical.
The capability is different.

### Detection Approaches

Several approaches exist for detecting contamination, each with limitations:

**N-gram overlap analysis.** Check whether exact n-gram sequences from the benchmark
appear in the training data. This catches direct contamination but misses paraphrases.
It also requires access to the training data, which commercial model providers generally
do not share.

**Membership inference attacks.** Present the model with real benchmark items and
plausible-looking synthetic items that are not in any benchmark. If the model performs
significantly better on the real items, contamination is suggested. This works only
when the synthetic items are sufficiently similar to control for difficulty.

**Canary token injection.** Include synthetic, easily-identifiable sequences in the
benchmark. If these sequences influence model behaviour, the training data likely
contains the benchmark. This is a prospective technique - it must be designed into the
benchmark before training data is collected.

**Performance decay on reformulation.** Rephrase benchmark questions while preserving
the underlying test. If performance drops significantly on rephrased versions, the model
may be relying on memorised phrasings rather than understanding. This is the most
practical post-hoc detection method but requires careful control for difficulty changes
introduced by rephrasing.

### Static vs Dynamic Benchmarks

The contamination problem has driven a shift from static to dynamic benchmarks.

**Static benchmarks** have a fixed question set that does not change. MMLU, MMLU-Pro,
HumanEval, and most published benchmarks are static. Their advantage is reproducibility:
you can compare scores across time because the test is the same. Their disadvantage is
contamination: the longer a static benchmark exists, the more likely its contents appear
in training data.

**Dynamic benchmarks** generate new questions periodically, making contamination of
future test sets impossible (or at least requiring re-contamination with each update).

LiveBench (White et al. 2024) is the clearest example of this approach. It generates
questions from recent sources - new math competition problems, recent arXiv papers,
current news events - and updates monthly. Questions are automatically scored against
objective ground truth, avoiding LLM judge biases. The design specifically targets
contamination resistance: if the source material did not exist when the model was
trained, the model cannot have memorised the answers.

Chatbot Arena (now Arena AI at lmarena.ai, Zheng et al. 2023) takes a different approach.
Instead of static questions, it uses live user-submitted prompts evaluated through blind
pairwise comparison. Each prompt is novel (submitted by the user in real time), making
contamination of the question set structurally impossible. The Elo rating system
aggregates across millions of such comparisons.

Both approaches trade off against static benchmarks. Dynamic benchmarks resist
contamination but sacrifice exact reproducibility. A model's LiveBench score in January
and March is on different question sets, making direct comparison imperfect. Arena
ratings fluctuate as the user population and question distribution change. Static
benchmarks are reproducible but vulnerable. The field has not converged on a resolution.

> **NOVEL:** The connection between content contamination and layer L0 in the layer
> model is drawn from this project's operational model. The layer model's definition
> of L0 - "frozen at inference time; model cannot modify its own weights mid-conversation"
> - makes the contamination mechanism structurally clear: benchmark data encoded at L0
> is indistinguishable from any other learned pattern, and no amount of prompting (L3)
> or human inspection (L12) can determine from the output alone whether a correct answer
> reflects reasoning or recall. The layer model provides a structural explanation for
> why contamination is fundamentally undetectable from the output layer alone.

> **AGENTIC GROUNDING:** When selecting benchmarks for comparing models to deploy in an
> agent system, contamination awareness is not optional. If you pick a benchmark whose
> contents are in every model's training data, your comparison measures "who memorised
> more," not "who reasons better." For agent tasks, prefer benchmarks with
> contamination-resistant properties: SWE-bench (real GitHub issues from after training
> cutoff), Arena (live user prompts), or custom evals built from your own proprietary
> data that has never been published.

---

## 4. Saturation and Discriminative Power

*Estimated time: 25 minutes*

A benchmark's value depends on its ability to distinguish between models (or between
versions of the same model). When models approach ceiling performance, this
discriminative power collapses.

### What Saturation Looks Like

MMLU was published in 2020 with a random-baseline accuracy of approximately 25% (four
choices per question). Early GPT-3 models scored around 43%. Within four years, frontier
models crossed 85%. As of March 2026, the best models exceed 90%. At some point in this
progression - and the exact point is debatable - the benchmark stopped being informative.

The problem is not that 90% is a high score. The problem is that the remaining 10% is
not a useful signal. When the best models all score between 88% and 92%, a 2-point
difference could reflect genuine capability differences, or it could reflect formatting
sensitivity (recall the 5% swing from parentheses changes), or it could reflect
statistical noise from the specific question sample. The benchmark cannot distinguish
between these explanations.

This is the same problem that occurs with any bounded measurement instrument at the
boundary. A ruler that measures 0-30 cm is useless for distinguishing between objects
that are all 29.5-30 cm long. The instrument is not broken. It has reached the limit
of its resolution.

### The Saturation Lifecycle

Benchmarks follow a lifecycle:

1. **Introduction.** A new benchmark is published. It is challenging - frontier models
   score modestly. The benchmark discriminates well across the capability spectrum.
   Researchers and developers use it to identify weaknesses and track progress.

2. **Adoption.** The benchmark becomes standard. It appears in model comparison tables,
   marketing materials, and procurement evaluations. Labs optimise against it. Its
   visibility increases.

3. **Contamination pressure.** The benchmark's questions appear in training data
   (directly or indirectly). Scores rise from a combination of genuine improvement
   and contamination.

4. **Saturation.** Frontier models approach ceiling performance. Score differences
   between top models are within the margin of measurement error. The benchmark no
   longer discriminates.

5. **Replacement.** A harder variant is published (MMLU-Pro, MMLU-Redux). Or an
   entirely new benchmark targeting a different construct is introduced. The cycle
   restarts.

MMLU is in stage 5. GPQA (Graduate-level Google-Proof Q&A) targets harder questions
designed by domain experts. SWE-bench targets software engineering with real GitHub
issues. MATH and GSM8K test mathematical reasoning. Each was introduced partly because
existing benchmarks had saturated.

### What Saturation Tells You

Saturation is informative even though the saturated benchmark is not. When a benchmark
saturates, it means either:

- Models have genuinely mastered the capability the benchmark tests, and a harder
  test is needed to find the frontier.
- Models have learned to produce high scores without mastering the capability
  (through contamination, format exploitation, or shortcut learning), and the
  benchmark's construct validity has degraded.

Distinguishing between these requires evidence beyond the benchmark itself - transfer
tests, reformulation experiments, ecological validity studies. A saturated score is
not evidence of mastery. It is evidence that the benchmark has stopped being
informative, for one reason or another.

> **AGENTIC GROUNDING:** When building an eval suite for your agent system, plan for
> saturation from the start. If your eval has 50 test cases and your agent passes 48
> on the first iteration, the eval will saturate quickly as you improve the system.
> Design evals with headroom: include cases you expect to fail for the foreseeable
> future, grade on a continuous scale rather than binary pass/fail where possible, and
> plan to extend the test set as performance improves. An eval that your system aces
> on day one is not an eval. It is a regression test.

---

## 5. Ecological Validity

*Estimated time: 30 minutes*

Ecological validity asks: **how well does the evaluation correspond to the conditions
under which the model will actually be used?**

A benchmark with high construct validity (it measures what it claims) can still have
low ecological validity (it does not reflect real-world conditions). The distinction
matters because all deployment decisions ultimately depend on real-world performance,
not benchmark performance.

### The Multiple-Choice Problem

Most academic benchmarks use multiple-choice format. This is convenient for automated
scoring - the answer is one of four or five options, and correctness is a simple string
match. But multiple-choice format fundamentally changes the task.

When a human expert answers a question, they generate the answer from their knowledge.
When a model answers a multiple-choice question, it selects from provided options. These
are different cognitive tasks. Selection is easier than generation because:

1. **Recognition is easier than recall.** The correct answer is present in the prompt.
   The model does not need to generate it from scratch - it needs to recognise it among
   distractors.

2. **Distractors leak information.** The incorrect options constrain the possibility
   space. If three of four options are clearly wrong, the model can arrive at the correct
   answer by elimination rather than knowledge.

3. **The format enables shortcuts.** Models can exploit statistical patterns in how
   answer choices are constructed (e.g., the longest option is often correct, options
   that partially repeat the question stem are often correct).

A model that scores 90% on multiple-choice chemistry questions may not be able to answer
the same questions in free-form format. The 90% score is real, but the inference "this
model knows college-level chemistry" may not transfer to the free-form setting where
the model will actually be used.

### SWE-bench: Ecological Validity Done Better

SWE-bench (Jimenez et al. 2024) represents a different approach. Instead of synthetic
problems or multiple-choice questions, SWE-bench uses real GitHub issues and their
corresponding pull requests from popular open-source Python repositories.

The eval presents the model with an issue description and the repository state at the
time the issue was filed. The model must produce a patch that resolves the issue. The
patch is validated by running the repository's test suite - the same tests that the
human developer's pull request had to pass.

This has high ecological validity because:

1. **The problems are real.** They come from actual software development, not synthetic
   generation.
2. **The evaluation criterion is functional.** The patch must pass tests, not match a
   reference answer string.
3. **The context is realistic.** The model works with a real codebase, not an isolated
   function signature.
4. **The difficulty distribution is naturalistic.** It reflects the distribution of real
   issues, not a curriculum designer's notion of difficulty.

SWE-bench's limitation is its narrow domain (Python, open-source, well-tested
repositories). But within that domain, it measures something much closer to "can this
model do software engineering" than any multiple-choice programming quiz.

### The Lab-to-Field Gap

The broader principle is that controlled evaluation conditions differ from deployment
conditions in ways that matter:

| Evaluation condition | Deployment condition |
|---------------------|---------------------|
| Single-turn question | Multi-turn conversation |
| Clean, well-formatted input | Messy, ambiguous user input |
| Isolated task | Task embedded in workflow |
| No time pressure | Latency requirements |
| Optimal prompt format | User's actual prompt |
| Test environment | Production environment with tool access |

Each discrepancy between evaluation and deployment conditions introduces a gap where
benchmark performance may not predict real-world performance. The more discrepancies,
the wider the gap.

HELM encountered this systematically. The project evaluated models using standardised
prompting across all models, but this standardisation itself was a departure from
real-world conditions where each model would be prompted in its preferred format. The
evaluation was reproducible and comparable, but ecologically invalid for models whose
preferred format differed from HELM's standard.

### Ecological Validity vs Construct Validity

These two validity types can conflict. A highly controlled evaluation (fixed format,
standardised conditions, isolated questions) maximises construct validity by controlling
confounds, but minimises ecological validity by removing real-world context. A
naturalistic evaluation (real tasks, real conditions, real users) maximises ecological
validity but introduces confounds that make it hard to isolate what is being measured.

Arena (lmarena.ai) optimises for ecological validity - real users, real prompts, real
preferences. SWE-bench optimises for ecological validity within its domain. MMLU
optimises for construct validity and cross-model comparability. No single eval can
maximise both. Good evaluation practice uses multiple evals with different validity
profiles.

> **AGENTIC GROUNDING:** Agent systems are particularly vulnerable to the
> lab-to-field gap. An agent evaluated on isolated tasks (generate this function,
> answer this question) may fail when those tasks are embedded in a multi-step
> workflow with tool calls, error recovery, and state management. If your agent will
> operate in a loop - reading files, making edits, running tests, interpreting results -
> your eval must test the loop, not just the individual capabilities. The quality gate
> in this project (`pnpm run typecheck && pnpm run lint && pnpm run test`) is an
> ecological eval: it tests the agent's output in the actual verification environment,
> not in an isolated sandbox.

> **FIELD MATURITY: ESTABLISHED** - Ecological validity is a standard concept in
> experimental psychology (Bronfenbrenner 1977, Brunswick 1956). The application to
> LLM benchmarking is emerging. SWE-bench (Jimenez et al. 2024) is the most cited
> example of a high-ecological-validity LLM benchmark.

---

## 6. The Evaluator's Regress

*Estimated time: 35 minutes*

Every evaluation requires an evaluator - something that determines whether the model's
output is correct, good, or acceptable. The evaluator's regress asks: **who evaluates
the evaluator?**

This is not a philosophical trick. It is a practical problem that every evaluation
pipeline must solve, and the solutions all have costs.

### Three Kinds of Evaluators

**Code-based evaluators** are functions that compute scores deterministically. Exact
string match, regex match, numerical comparison, test suite execution. Their advantage
is perfect reliability: run them twice, get the same answer. Their limitation is that
they can only evaluate what can be expressed as a computable criterion. "Is this answer
factually correct?" is hard to express as a regex. "Is this response helpful?" is
impossible.

**Human evaluators** can judge anything - quality, helpfulness, safety, nuance, tone,
cultural appropriateness. Their limitation is that they are expensive, slow, and
inconsistent. Two humans rating the same output will disagree. The same human rating
the same output on different days may disagree with themselves.

**LLM evaluators** (LLM-as-judge) sit between the two. They can evaluate open-ended
qualities like a human, at the speed and cost of code. Their limitation is that they
have systematic biases, and those biases may correlate with the biases of the model
being evaluated.

### Human Disagreement and Cohen's Kappa

When humans evaluate LLM outputs, they disagree. The question is: how much disagreement,
and what does it mean?

Inter-rater reliability measures the extent to which different evaluators agree.
Cohen's kappa (Cohen 1960) is the standard metric for two raters, correcting for
agreement that would occur by chance alone:

```
kappa = (P_observed - P_expected) / (1 - P_expected)
```

Where `P_observed` is the proportion of items on which raters agree, and `P_expected`
is the proportion of agreement expected by chance given each rater's distribution of
ratings.

The interpretation scale (Landis & Koch 1977):

| Kappa | Interpretation |
|-------|---------------|
| < 0.00 | Poor (worse than chance) |
| 0.00 - 0.20 | Slight agreement |
| 0.21 - 0.40 | Fair agreement |
| 0.41 - 0.60 | Moderate agreement |
| 0.61 - 0.80 | Substantial agreement |
| 0.81 - 1.00 | Almost perfect agreement |

For LLM evaluation tasks, human inter-rater reliability varies widely by task type:

- **Factual correctness:** typically high kappa (0.7-0.9) - raters agree on facts
- **Helpfulness:** moderate kappa (0.4-0.6) - raters have different notions of helpful
- **Safety:** variable kappa (0.3-0.7) - raters disagree on borderline cases
- **Quality/style:** low kappa (0.2-0.4) - raters have personal preferences

These numbers have a direct implication for LLM evaluation: **if humans agree only 60%
of the time on whether a response is "helpful," then an LLM judge that agrees with
humans 60% of the time is achieving human-level performance on this task.** The ceiling
for LLM-as-judge accuracy is set by human inter-rater reliability, not by 100%.

### LLM-as-Judge Biases

The MT-Bench study (Zheng et al. 2023) found that GPT-4 as a judge achieves greater
than 80% agreement with human preferences - "the same level of agreement between
humans." This is encouraging, but the biases identified in the study are systematic
and important:

**Position bias.** LLM judges prefer the response presented first (or second, depending
on the model and prompt format). If you ask "Which response is better, A or B?", the
judge's preference is partly determined by which response occupies position A. The
mitigation is to swap positions and average, but this doubles evaluation cost.

**Verbosity bias.** LLM judges prefer longer, more detailed responses regardless of
quality. A verbose but mediocre response may be rated higher than a concise, precise
one. This bias aligns with a known training signal: RLHF training often rewards
verbosity because human raters in training pipelines conflate length with thoroughness.

**Self-enhancement bias.** Models rate their own outputs higher than those of other
models. This means using the same model as both generator and judge produces inflated
scores. Anthropic's eval documentation notes: "Generally best practice to use a
different model to evaluate than the model used to generate the evaluated output."

**Limited reasoning verification.** LLM judges struggle to verify mathematical
reasoning, logical proofs, and code correctness. They may confidently rate an incorrect
mathematical derivation as correct because the surface form looks right. For tasks
requiring logical or mathematical verification, code-based evaluators should be preferred
over LLM judges.

The MT-Bench paper proposes mitigations: swap positions and average (for position bias),
require chain-of-thought before scoring (for reasoning), use reference answers where
available, use multiple models and aggregate. These mitigations reduce but do not
eliminate the biases.

### The Regress in Practice

The evaluator's regress creates a practical problem for evaluation pipeline design.
Consider this chain:

1. A model generates output.
2. An LLM judge evaluates the output.
3. A human spot-checks the LLM judge's evaluations.
4. A second human reviews the first human's spot-checks (to calibrate the human).
5. ...

At some point, you must stop and trust an evaluator. The question is where to stop,
and the answer depends on the stakes. For a chatbot preference eval, stopping at step 2
(LLM judge) may be acceptable. For a safety eval, stopping before step 3 (human review)
is not.

Anthropic describes this as the "ouroboros" of model-generated evaluations: models
generating evaluations of model outputs, evaluated by models. The circularity is not
a logical error - it can produce useful signal. But it means the evaluation system has
correlated failure modes. If the judge model has a blind spot, that blind spot will not
be detected by the evaluation system itself.

### Cohen's Kappa for LLM Judge Calibration

Cohen's kappa provides a practical tool for calibrating LLM judges. The procedure:

1. Create a calibration set of model outputs with known-correct human judgments.
2. Run the LLM judge on the calibration set.
3. Compute kappa between the LLM judge's ratings and the human ratings.
4. If kappa is below the threshold you need (0.6 for most tasks, 0.8 for safety),
   iterate on the rubric, prompt format, or model choice.

The kappa value tells you how much trust to place in the LLM judge for the specific
task, rubric, and output distribution in your calibration set. It does not generalise
to different tasks, rubrics, or distributions without re-calibration.

> **NOVEL:** The oracle problem from this project's layer model (AGENTS.md lexicon:
> "L12 error propagates through all verification layers because no layer has authority
> above L12") is the evaluator's regress stated structurally. In the layer model, L12
> (the human evaluator) is the only truly model-independent verification layer. But L12
> has its own error rate, and no higher layer exists to catch L12's errors. This creates
> the fundamental tension: the only independent verification layer is also the layer
> whose errors cannot be caught by any other layer. Applied to evaluation design, this
> means human evaluation is the highest-authority standard, but human evaluation is not
> error-free, and there is no meta-evaluation that can catch human evaluator errors
> without introducing another human (with their own errors) into the chain.

> **AGENTIC GROUNDING:** The evaluator's regress is why the verification pipeline in
> this project uses multiple independent layers rather than a single authority. The
> quality gate (automated) catches what code can catch. Adversarial review (multi-model)
> catches what automated tests miss. Human review (L12) catches what models miss. No
> single layer is trusted in isolation. The oracle problem means L12 errors still
> propagate - this is accepted as an irreducible risk, not solved by adding more layers.

> **FIELD MATURITY: EMERGING** - LLM-as-judge is a rapidly developing practice. The
> MT-Bench paper (Zheng et al. 2023) is the most cited reference. The biases (position,
> verbosity, self-enhancement) are documented but mitigation strategies are not
> standardised. Cohen's kappa as a calibration tool for LLM judges is established
> statistical methodology applied to a new domain.

---

## 7. Goodhart's Law Applied to Evaluations

*Estimated time: 25 minutes*

Charles Goodhart formulated the principle in 1975 in the context of monetary policy:
"Any observed statistical regularity will tend to collapse once pressure is placed upon
it for control purposes" (Goodhart 1984). The common paraphrase is sharper: **when a
measure becomes a target, it ceases to be a good measure.**

Applied to LLM evaluation: when model developers optimise for benchmark scores, the
benchmark scores inflate beyond what the underlying capability warrants. The benchmark
stops measuring capability and starts measuring optimisation effort directed at the
benchmark.

### The Mechanism

Goodhart's law operates through multiple channels in LLM evaluation:

**Training data selection.** If benchmark performance matters for marketing and funding,
there is an incentive (conscious or unconscious) to ensure training data includes
material similar to benchmark questions. This is contamination (Section 3), but
Goodhart's law explains why contamination is not just an accident - it is an incentive.

**Prompt engineering for benchmarks.** Labs discover that specific prompting strategies
improve benchmark scores. These strategies are then used during evaluation but not during
deployment. The benchmark score reflects the optimised evaluation condition, not the
deployment condition. This is an ecological validity problem (Section 5) driven by
Goodhart incentives.

**Architecture and training choices.** When a benchmark tests a specific capability
(e.g., multiple-choice question answering), labs may make architecture or training
decisions that improve that capability at the expense of other capabilities that are
not benchmarked. A model optimised for MMLU may sacrifice conversational ability,
instruction following, or safety properties that MMLU does not measure.

**Selective reporting.** With many benchmarks available, a lab can choose to emphasise
the benchmarks on which their model performs best and downplay those on which it does
not. This does not inflate any single benchmark score, but it creates a selection bias
in the public's understanding of model capabilities.

### The Leaderboard Incentive Structure

The community of LLM developers has created an informal leaderboard culture. Benchmark
scores are published in model release announcements, compared in blog posts, tracked on
public leaderboards (Open LLM Leaderboard, Arena, HELM), and cited in procurement
decisions. This culture creates strong incentives:

- Labs that score well on prominent benchmarks receive more attention, more API revenue,
  more investment, and more talent.
- Labs that score poorly face pressure to improve scores, regardless of whether the
  scores reflect deployment-relevant capabilities.
- New benchmarks that are too hard (frontier models score poorly) may be dismissed as
  "not ready" rather than adopted as revealing.

The result is a feedback loop. Benchmark scores drive investment. Investment funds
optimisation. Optimisation targets benchmarks. Benchmark scores improve. Whether
capabilities improve at the same rate is an empirical question that the benchmarks
themselves cannot answer, because they are the target of optimisation.

Campbell's Law (1979) states the same principle more explicitly: "The more any
quantitative social indicator is used for social decision-making, the more subject
it will be to corruption pressures and the more apt it will be to distort and corrupt
the social processes it is intended to monitor."

### Recognising Goodhart Effects

Signs that Goodhart's law is operating on a benchmark:

1. **Score inflation without capability transfer.** Benchmark scores rise but
   performance on related (non-benchmarked) tasks does not improve proportionally.

2. **Formatting sensitivity.** Small changes to the evaluation format produce large
   score changes, suggesting the model has learned to exploit the specific format rather
   than develop the underlying capability.

3. **Contamination evidence.** Models perform better on benchmark questions than on
   novel questions testing the same concepts.

4. **Saturation clustering.** Many models score within a narrow band near the ceiling,
   suggesting they have all converged on similar optimisation strategies rather than
   developing genuinely different capabilities.

5. **Disconnect from user preference.** Models that score highest on benchmarks are not
   the ones users prefer in blind comparisons (Arena). This disconnect suggests the
   benchmarks are measuring something different from user-perceived quality.

### The Defense: Diversification

The primary defense against Goodhart's law in evaluation is diversification:

- Use multiple benchmarks, not a single headline number.
- Include dynamic benchmarks that resist optimisation (LiveBench, Arena).
- Include ecological evaluations that test real-world conditions (SWE-bench, custom
  task-specific evals).
- Include human preference evaluations that are not game-able through optimisation.
- Rotate benchmarks periodically, retiring saturated ones and introducing new ones.
- Build custom evals on proprietary data that cannot appear in training corpora.

No single defense is sufficient. The point is not to eliminate Goodhart effects - they
are structurally inevitable when measurement informs decisions - but to diversify
measurement enough that optimising for any single metric does not produce misleading
aggregate performance claims.

> **SLOPODAR:** "Analytical lullaby" - warm numbers with no caveats. A model card
> reporting "95% on MMLU, 89% on HumanEval, 92% on ARC" looks impressive until you
> ask: Are these benchmarks saturated? Is there contamination evidence? How were the
> prompts formatted? What capabilities are not benchmarked? The headline numbers are
> real. What they prove is not what they look like they prove.

> **AGENTIC GROUNDING:** Goodhart's law applies to your own evals, not just public
> benchmarks. If you build an eval for your agent system and then iteratively improve
> the agent to pass the eval, the eval's discriminative value degrades over time.
> The agent learns to pass your specific tests, which may not generalise to the
> real-world conditions the tests are meant to represent. Periodically expand the
> eval suite, add novel test cases, and check whether eval performance predicts
> deployment performance. If it does not, your eval has Goodharted.

> **FIELD MATURITY: ESTABLISHED** - Goodhart's law (1975/1984) and Campbell's law
> (1979) are well-established principles in economics and sociology. Their application
> to ML benchmarks is widely discussed in the research community (e.g., Raji et al.
> 2021, "AI and the Everything in the Whole Wide World Benchmark"). The specific
> mechanisms in LLM evaluation are emerging.

---

## 8. Sensitivity and Specificity

*Estimated time: 25 minutes*

Every evaluation can make two kinds of errors:

- **False positive (Type I):** the eval says the model succeeded when it actually
  failed. The model appears capable when it is not.
- **False negative (Type II):** the eval says the model failed when it actually
  succeeded. The model appears incapable when it is not.

Which error is more costly depends entirely on the application domain.

### The Medical Diagnostics Framework

Sensitivity and specificity come from medical diagnostics (Altman & Bland 1994), where
the costs of different error types are well-understood:

**Sensitivity** (true positive rate) measures: of all actual positives, how many does
the test correctly identify? In eval terms: of all cases where the model gets the answer
wrong, how many does the eval correctly flag as wrong?

```
Sensitivity = True Positives / (True Positives + False Negatives)
```

**Specificity** (true negative rate) measures: of all actual negatives, how many does
the test correctly identify? In eval terms: of all cases where the model gets the answer
right, how many does the eval correctly confirm as right?

```
Specificity = True Negatives / (True Negatives + False Positives)
```

A highly sensitive eval catches almost all real failures but may generate false alarms.
A highly specific eval produces few false alarms but may miss real failures.

### Domain-Dependent Cost Asymmetry

The relative cost of false positives and false negatives varies dramatically by domain:

**Medical screening analogy.** For cancer screening, a false negative (telling a cancer
patient they are healthy) is catastrophic. A false positive (telling a healthy person
they might have cancer, triggering further testing) is costly but recoverable. Screening
tests optimise for sensitivity (catch all real cases) and accept lower specificity
(accept some false alarms).

**Spam filtering analogy.** For email spam filters, a false positive (a legitimate email
classified as spam) causes direct harm - the user misses an important message. A false
negative (a spam email reaching the inbox) is annoying but recoverable. Spam filters
must balance sensitivity and specificity carefully, often erring toward specificity
(do not block legitimate email).

**For LLM evaluation, the cost asymmetry depends on the eval's purpose:**

| Eval purpose | More dangerous error | Optimise for |
|-------------|---------------------|-------------|
| Safety eval | False negative (unsafe output passes) | Sensitivity |
| Code correctness | False negative (buggy code passes tests) | Sensitivity |
| Content moderation | False positive (legitimate content blocked) | Specificity |
| Capability benchmark | Either (depends on use) | Balance |

### The Safety Eval Preview

This section previews a theme developed fully in Step 7 (Red Teaming for
Safety-Critical Capabilities). For safety evaluations, the cost asymmetry is extreme
and well-defined.

A safety eval that says "this model is safe" when it is not (false negative) can lead
to deployment of a dangerous system. A safety eval that says "this model is unsafe"
when it is safe (false positive) delays deployment but does not cause harm. The
asymmetry is categorical: false negatives are potentially catastrophic; false positives
are merely expensive.

This means safety evals should optimise for sensitivity, accepting a higher false
positive rate. In practice, this means:

- Test more adversarial scenarios than you think necessary.
- Flag borderline cases as failures, not passes.
- Treat the absence of detected failures as insufficient evidence of safety,
  not as evidence of safety.
- Design the eval to have a high base rate of triggering (if the eval never triggers,
  it may not be testing hard enough).

The asymmetric cost structure of safety evaluation is one of the reasons Step 7 exists
as its own step in this bootcamp, rather than being a subsection of scoring methods.

### Sensitivity-Specificity Tradeoffs in Eval Design

When you design an eval, you make implicit decisions about the sensitivity-specificity
tradeoff through:

**Threshold selection.** If your eval uses a continuous score (e.g., LLM judge rating
1-5), you choose a threshold for "pass." A threshold of 4 is more specific (fewer false
positives) but less sensitive (more false negatives) than a threshold of 3.

**Rubric strictness.** A strict rubric with many required criteria catches more real
failures (high sensitivity) but also flags acceptable outputs that miss minor criteria
(lower specificity). A loose rubric accepts more variation (high specificity) but
misses real problems (lower sensitivity).

**Evaluation method.** Code-based evaluation (exact match, test suite) tends to be
highly specific (if it passes, it really works) but may have lower sensitivity (there
are failure modes the tests do not cover). LLM-based evaluation can be more sensitive
(catching subtle quality issues) but less specific (flagging acceptable outputs as
problematic).

Every eval design choice shifts the sensitivity-specificity tradeoff. Making these
choices explicitly, based on the cost structure of your application, is better than
making them accidentally through default parameter values.

> **NOVEL:** The "not wrong" pattern from this project's slopodar is a false negative
> by definition. An output that "passes every heuristic check, every factual gate,
> every syntax rule, and still isn't right" is a case where the eval system's
> sensitivity was insufficient to detect the real problem. "Not wrong" names the specific
> failure mode: the eval is specific (it correctly confirms passes) but not sensitive
> enough to catch outputs that satisfy formal criteria while failing informal ones.
> The only instrument that catches "not wrong" is L12 (human judgment), which is why
> the slopodar entry states: "the only instrument is a human who will say 'this isn't
> good enough' when every dashboard is green."

> **AGENTIC GROUNDING:** When designing evals for agent systems, be explicit about your
> error cost structure. An agent writing code that passes its own tests (false negative -
> buggy code passes) is more dangerous than an agent whose code is flagged incorrectly
> by an overly strict linter (false positive - correct code flagged). For safety-adjacent
> agent tasks (database migrations, API deployments, permission changes), design evals
> that prioritise sensitivity. For creative tasks (generating documentation, writing
> emails), higher specificity may be more appropriate.

---

## 9. The Layer Model and Evaluation

*Estimated time: 20 minutes*

This section maps the evaluation concepts covered in this step to the layer model from
the project's operational documentation. The layer model provides a structural framework
for understanding where evaluation problems originate and why they are difficult to
detect.

### L0 WEIGHTS: Where Contamination Lives

L0 represents everything frozen at inference time - the model's weights, which encode
the training distribution, inductive biases, and RLHF alignment. Content contamination
(Section 3) is an L0 problem. When benchmark data appears in the training distribution,
it becomes part of the weights. The model cannot distinguish between learned reasoning
patterns and memorised benchmark patterns, because at L0 there is no distinction. Both
are statistical regularities encoded in the same parameters.

The layer model makes clear why contamination is structurally undetectable from the
output alone. L0 is frozen and opaque. No amount of prompting (L3), tool use (L7),
or multi-agent review (L10/L11) can inspect L0 directly. Detection requires indirect
methods: membership inference, reformulation testing, or access to training data
provenance. The contamination is in the foundation, beneath all other layers.

### L3 CONTEXT: Where Format Sensitivity Lives

L3 represents the context window - its utilisation, saturation characteristics, and
the primacy/recency/lost-middle effects that govern how models attend to different
parts of the input. The MMLU formatting sensitivity (Section 2) is an L3 phenomenon.
When changing answer labels from (A) to [A] shifts accuracy by 5%, the eval is
measuring L3 properties (how the model processes different formatting tokens) alongside
the intended construct.

The layer model documents several L3 effects relevant to evaluation:

- **Primacy bias:** content early in the context window receives disproportionate
  attention. If eval questions are presented in a fixed order, earlier questions may
  be processed differently from later ones.
- **Lost-in-the-middle:** content in the middle of long contexts receives less
  attention than content at the beginning or end. For evals with many questions in
  a single prompt, question position affects performance.
- **Format sensitivity:** the exact tokenisation of the prompt (spacing, punctuation,
  line breaks) affects model behaviour in ways that are not visible in the text but are
  significant at the token level.

These L3 effects mean that every eval is implicitly measuring a mixture of the intended
construct and the model's L3 sensitivity profile. Controlling for L3 effects requires
careful prompt design, position randomisation, and sensitivity testing.

### L12 HUMAN: The Oracle Problem

L12 represents the human-in-the-loop - the only truly model-independent layer. In
evaluation, the human is the ultimate evaluator, the oracle against which LLM judges are
calibrated and evaluation rubrics are validated. But the oracle has an error rate.

The oracle problem, as defined in this project's lexicon: "L12 error propagates through
all verification layers because no layer has authority above L12." In evaluation terms:
if the human evaluators who create the gold standard are wrong about what constitutes
a correct or high-quality answer, that error propagates through the entire evaluation
pipeline. Every LLM judge calibrated against the flawed human standard inherits the
flaw. Every rubric validated against human preferences inherits human biases.

The oracle problem is not an argument against human evaluation. It is an argument for
recognising human evaluation as a powerful but fallible instrument, subject to the same
scrutiny we apply to automated evaluators. When Cohen's kappa between human raters is
0.6, the remaining 0.4 is not "noise" - it is genuine disagreement about what
constitutes quality, and the evaluation system must account for it.

The layer model also documents a scaling constraint at L12: "Review depth degrades
inversely with agent count." As the volume of model outputs increases (more models, more
tasks, more evaluations), human evaluation capacity stays constant. The pressure to
replace human evaluation with automated evaluation is not just economic - it is
structural. But the oracle problem means full replacement introduces systematic blind
spots at L12 that no other layer can detect.

> **NOVEL:** The mapping of evaluation problems to specific layers in the layer model -
> contamination at L0, format sensitivity at L3, oracle problem at L12 - is drawn from
> this project's operational documentation. The layer model was built to describe the
> human-AI engineering stack, not evaluation specifically, but the mapping reveals
> structural relationships: contamination is hard to detect because L0 is opaque,
> format sensitivity is hard to control because L3 effects are numerous and interact,
> and the oracle problem is irreducible because L12 is the terminal layer. The composed
> view across layers is novel; the individual observations are established or emerging.

---

## 10. Key Concepts / Vocabulary

These terms are used throughout this bootcamp. You should be able to define each from
memory before proceeding to Step 2.

**Construct validity.** The extent to which an evaluation measures the construct (skill,
knowledge, capability) it claims to measure. A test with low construct validity measures
something other than what its name implies. Source: Messick (1989).

**Ecological validity.** The extent to which evaluation conditions correspond to
real-world conditions. A test with high ecological validity predicts real-world
performance; a test with low ecological validity may not. Source: Bronfenbrenner (1977).

**Content contamination.** The presence of benchmark data in model training data, causing
the benchmark to measure memorisation rather than capability. Analogous to students
seeing exam questions before the test.

**Saturation.** The point at which models approach ceiling performance on a benchmark,
causing the benchmark to lose discriminative power. A saturated benchmark cannot
distinguish between models (or model versions).

**Discriminative power.** A benchmark's ability to distinguish between models of
different capability levels. Measured by the spread and distribution of scores across
models.

**Evaluator's regress.** The recursive problem of evaluating the evaluator. If an LLM
judges model outputs, who judges the LLM's judgments? If a human reviews the LLM's
judgments, who reviews the human?

**Inter-rater reliability.** The extent to which different evaluators agree on the same
items. Measured by Cohen's kappa (two raters) or Fleiss' kappa (multiple raters).

**Cohen's kappa.** A statistical measure of inter-rater agreement corrected for chance.
kappa = (P_observed - P_expected) / (1 - P_expected). Range: -1 to 1. Values above
0.6 are generally considered substantial agreement. Source: Cohen (1960).

**Goodhart's law.** "When a measure becomes a target, it ceases to be a good measure."
Originally formulated for monetary policy (Goodhart 1975/1984). Applied to LLM evals:
when benchmark scores drive decisions, the scores inflate beyond what capability warrants.

**Sensitivity (true positive rate).** The proportion of actual failures correctly
identified by the eval. A sensitive eval catches most real problems.

**Specificity (true negative rate).** The proportion of actual successes correctly
confirmed by the eval. A specific eval produces few false alarms.

**False positive (Type I error).** The eval says the model failed when it actually
succeeded. Cost: unnecessarily blocked deployment, wasted debugging effort.

**False negative (Type II error).** The eval says the model succeeded when it actually
failed. Cost: deploying a system that does not work as claimed.

**Dynamic benchmark.** A benchmark that periodically regenerates its question set,
resisting contamination. Examples: LiveBench (monthly updates), Arena (live user prompts).

**Static benchmark.** A benchmark with a fixed question set. Reproducible but vulnerable
to contamination over time. Examples: MMLU, HumanEval.

**LLM-as-judge.** Using an LLM to evaluate another LLM's outputs. Fast and scalable,
but introduces systematic biases (position, verbosity, self-enhancement).

**Oracle problem.** The evaluator of highest authority (typically human) has its own
error rate, and no higher-authority evaluator exists to catch those errors. From this
project's layer model: "L12 error propagates through all verification layers because
no layer has authority above L12."

---

## 11. Challenges

*Estimated time: 60-90 minutes total*

These challenges exercise the concepts from this step. They are designed to build
evaluation thinking, not to build evaluation infrastructure (that comes in later steps).
Each one can be completed with a text editor, a calculator, and access to an LLM API.

---

### Challenge 1: Construct Validity Analysis

*Estimated time: 15 minutes*
*Type: Analyse*

Below are three benchmark descriptions. For each one, identify: (a) what the benchmark
claims to measure, (b) what it actually measures (including confounds), and (c) a
scenario where the score is misleading.

**Benchmark A:** A 500-question multiple-choice test of Python programming knowledge.
Questions cover syntax, standard library functions, and common patterns. The model
selects from four options per question. Accuracy is reported as a single percentage.

**Benchmark B:** A summarisation eval. The model is given a 2,000-word article and must
produce a 100-word summary. Scoring uses ROUGE-L (longest common subsequence) against
a human-written reference summary.

**Benchmark C:** A customer service chatbot eval. Real customer queries are submitted
to the model. An LLM judge (the same model family as the chatbot) rates each response
on a 1-5 helpfulness scale.

**Deliverable:** For each benchmark, a paragraph covering (a), (b), and (c). Be
specific about the confounds - name the validity type(s) that each confound threatens.

**Evaluation criteria:** Your analysis should identify at least one confound per
benchmark that would not be obvious from the benchmark score alone.

<details>
<summary>Design guidance</summary>

For Benchmark A, think about what multiple-choice format measures vs what free-form
coding measures. Consider: could a model score well on this by recognising common
answer patterns without being able to write Python?

For Benchmark B, think about what ROUGE-L actually computes. Can two summaries be
equally good but score very differently on ROUGE-L? What if the reference summary
uses different vocabulary from the model's summary?

For Benchmark C, look for the evaluator's regress problem. What specific bias does
the evaluation setup introduce? Consider also what "helpfulness" means and how much
raters would agree on it.

</details>

---

### Challenge 2: Contamination Detection Design

*Estimated time: 20 minutes*
*Type: Design*

You are evaluating a new model on an existing coding benchmark (100 problems, each
requiring the model to produce a Python function). You suspect the model may have seen
some or all of the benchmark problems during training, but you have no access to the
training data.

Design a procedure to test for contamination. Your design must:

1. Describe at least two different detection methods.
2. Explain what evidence each method would produce if contamination is present vs absent.
3. Identify the limitations of each method (what kind of contamination would it miss?).

**Deliverable:** A 1-page procedure document (bullet points are fine) describing your
contamination detection approach.

**Design constraints:**
- You cannot access or inspect the model's training data.
- You have API access to the model (can submit prompts, receive completions).
- You have the original benchmark problems and solutions.
- You have a budget of approximately 500 API calls.

**Evaluation criteria:** Each method should be practical (implementable with the stated
constraints), and the limitations section should be honest (no method catches all
contamination).

<details>
<summary>Design guidance</summary>

Consider these approaches:

**Reformulation:** Rewrite the benchmark problems. Change variable names, restructure
the problem statement, use different examples, but keep the core task identical. If the
model performs significantly better on the original formulation than the reformulation,
it may be relying on memorised patterns rather than understanding.

**Canary comparison:** Create synthetic problems that closely match the benchmark's
style and difficulty but have never been published. Compare performance on real benchmark
problems vs synthetic problems. A large gap suggests contamination.

**Completion probing:** Give the model the first half of a benchmark problem and see if
it completes the rest verbatim or near-verbatim. Memorised content may be completable
from a prefix.

Think about: How many API calls does each method require? What statistical test would
you use to determine if the performance gap is significant?

</details>

---

### Challenge 3: Eval Sensitivity Test

*Estimated time: 20 minutes*
*Type: Build*

Take a simple evaluation task (e.g., answering factual questions, classifying sentiment,
or solving arithmetic). Create 10 test items. Run the eval under three different prompt
format variations:

- **Format A:** Bare question (e.g., "What is the capital of France?")
- **Format B:** Instructional prefix (e.g., "Answer the following question accurately:
  What is the capital of France?")
- **Format C:** System prompt + structured format (e.g., system prompt setting the role,
  question in a specific template, answer format specified)

Report the accuracy under each format. Calculate the maximum score difference across
formats.

**Deliverable:** A table showing accuracy per format, plus a paragraph interpreting the
results in terms of construct validity.

**Design constraints:**
- Use the same 10 test items across all three formats.
- Use temperature=0 (or the lowest available setting) to minimise randomness.
- Use the same model for all three runs.

**Evaluation criteria:** The interpretation paragraph should correctly identify whether
the observed score differences reflect construct validity concerns. A difference of
0-5% may be noise. A difference of 10%+ is likely a construct validity signal.

<details>
<summary>Design guidance</summary>

Here is a minimal Python template for running the test:

```python
import json

# 10 factual questions with known answers
items = [
  {"q": "What is the chemical symbol for gold?", "a": "Au"},
  {"q": "What year did World War II end?", "a": "1945"},
  # ... 8 more items
]

formats = {
  "bare": lambda q: q,
  "instructional": lambda q: f"Answer the following question accurately: {q}",
  "structured": lambda q: f"You are a knowledgeable assistant. Answer the question below.\n\nQuestion: {q}\nAnswer:",
}

# For each format, send each question to the API and check if the answer
# contains the expected string. Record accuracy per format.
```

The specific numbers matter less than the analysis. If all three formats produce
identical results, that is a finding worth reporting (the eval is robust to format
variation for this task). If they differ, identify which format produces the highest
and lowest scores, and hypothesise why.

</details>

---

### Challenge 4: Goodhart's Law in Action

*Estimated time: 20 minutes*
*Type: Design*

Design a simple eval for a specific task (choose one: email summarisation, code review
comment generation, or meeting notes extraction). Then, without changing the underlying
model, describe three specific strategies that could increase the eval score without
actually improving performance on the real task.

For each gaming strategy, explain:

1. What the strategy does.
2. Why the eval score improves.
3. Why real-world performance does not improve (or gets worse).
4. How you could modify the eval to resist this strategy.

**Deliverable:** The eval design (1 paragraph) plus three gaming strategies (1 paragraph
each) with defenses.

**Design constraints:**
- The eval must be reasonable - something you would actually consider using.
- The gaming strategies must be realistic - things that could happen through
  optimisation pressure, not adversarial attacks.
- The defenses must be practical.

**Evaluation criteria:** The gaming strategies should be non-obvious. "Just memorise the
test data" is valid but trivial. Better answers identify subtler ways the eval's proxy
measure can diverge from the real objective.

<details>
<summary>Design guidance</summary>

Example for email summarisation:

**Eval design:** Given 50 email threads and reference summaries, measure ROUGE-L and
human-rated relevance (1-5 scale).

**Gaming strategy 1:** Optimise summaries to include key phrases from the reference
summaries (improving ROUGE-L) even when those phrases are not the most informative
description of the email. ROUGE-L goes up; summary quality may go down because the
model is targeting surface overlap rather than information extraction.

Think about what happens when the model learns to exploit the specific scoring
mechanism. What would a human reader notice that the score does not capture?

</details>

---

### Challenge 5: Design a Contamination-Resistant Benchmark

*Estimated time: 20 minutes*
*Type: Design*

Design a benchmark for testing a model's ability to [choose one: extract structured data
from unstructured text, answer questions about scientific papers, or debug code]. Your
benchmark must resist contamination through at least two mechanisms.

**Deliverable:** A 1-page benchmark design document covering:

1. Task description (what the model must do)
2. Data source (where questions come from)
3. Scoring method (how answers are evaluated)
4. Contamination resistance mechanisms (at least two, with explanation of how each works)
5. Update cadence (how often the benchmark is refreshed)
6. Limitations (what the benchmark does not measure, and known weaknesses)

**Design constraints:**
- The benchmark must be automatically scorable (no human judges required for scoring).
- The data source must be publicly describable (no "secret test set" as the sole
  contamination defense).
- The update mechanism must be practically feasible (not "regenerate 10,000 expert-
  crafted questions monthly").

**Evaluation criteria:** The contamination resistance mechanisms should be structurally
sound, not just aspirational. Explain why each mechanism works, not just what it does.

<details>
<summary>Design guidance</summary>

LiveBench's approach is instructive: use recently-created source material (after training
data cutoff) with objective answers. Think about what source material in your chosen
domain is created regularly and has verifiable answers.

For scientific paper QA: new arXiv papers are published daily. Questions can be
automatically generated from papers published after a cutoff date. Answers can be
verified against the paper text.

For code debugging: new bugs are filed against open-source projects continuously.
Bugs with associated test cases provide automatic verification.

Consider also: what happens when the benchmark itself becomes part of training data?
How does your design handle the steady-state where the benchmark's existence is known?

</details>

---

### Challenge 6: The Not-Wrong Eval

*Estimated time: 15 minutes*
*Type: Analyse*

This challenge is about the gap between "passes all checks" and "is actually good."

You have an agent that generates documentation pages. Your eval checks:
- Factual accuracy (verified against source material): 98% correct
- Grammar and spelling: 99.5% error-free
- Coverage (all required sections present): 100%
- Readability score (Flesch-Kincaid): Grade 10 (target: Grade 8-12)
- Tone classification (professional/casual/academic): 95% match to target

All metrics are green. The documentation is not wrong.

A human reviewer reads the generated pages and says: "I would not put my name on any of
these."

Write an analysis (300-500 words) addressing:

1. What is the human detecting that the metrics are not capturing?
2. Why is this failure mode structurally difficult to evaluate with automated metrics?
3. Propose one additional evaluation mechanism that might catch this problem. Explain
   why it might work and what its limitations are.

**Deliverable:** Written analysis (300-500 words).

**Evaluation criteria:** The analysis should correctly identify that "not wrong" is a
sensitivity failure (the eval has high specificity but insufficient sensitivity for
quality dimensions that resist quantification), and should connect this to the
evaluator's regress - the human reviewer is exercising L12 judgment that may not be
decomposable into automatable criteria.

<details>
<summary>Design guidance</summary>

Think about what makes writing good vs merely correct. Consider: voice, coherence across
sections (not just within), the sense that someone who understands the topic wrote it
vs someone who collected relevant facts. These qualities are real and humans detect
them reliably, but they resist decomposition into measurable features.

The slopodar entry for "not wrong" states: "the only instrument is a human who will
say 'this isn't good enough' when every dashboard is green." Your analysis should
engage with whether this is a permanent limitation or a temporary one (i.e., will
better metrics eventually capture what the human detects?).

Consider: A/B testing against human-written documentation (does the reader prefer
the human version? can they tell the difference?) as a possible evaluation mechanism.
What are its limitations?

</details>

---

## 12. Key Takeaways

Before moving to Step 2, you should be able to answer these questions without looking
anything up:

1. What is the difference between a score, a construct, and an inference? Why does this
   distinction matter for evaluation?

2. What did the MMLU formatting experiment reveal about construct validity? What was
   being measured that was not intended?

3. Why is content contamination a problem at L0 in the layer model? Why can't you detect
   it by asking the model?

4. What are two differences between static and dynamic benchmarks? Name one example
   of each.

5. What is ecological validity? Give an example of an evaluation with high ecological
   validity and one with low ecological validity for the same capability.

6. What are the three kinds of evaluators (code-based, human, LLM)? What is the primary
   limitation of each?

7. What does a Cohen's kappa of 0.6 mean in practical terms? Why does human inter-rater
   reliability set a ceiling for LLM judge accuracy?

8. State Goodhart's law. Give an example of how it operates in LLM evaluation.

9. For a safety evaluation, should you optimise for sensitivity or specificity? Why?

10. What is the oracle problem? Why does it matter for evaluation design?

If you can answer all ten from memory, you have the measurement foundation for
everything that follows in this bootcamp.

---

## 13. Recommended Reading

These are not required for subsequent steps, but they are the primary sources for deeper
understanding:

- **Anthropic, "Challenges in evaluating AI systems"** (Ganguli et al. 2023). The most
  practitioner-accessible treatment of LLM evaluation challenges. Covers MMLU formatting
  sensitivity, BBQ bias trap, content contamination, and the difficulty scaling from
  multiple-choice to expert red teaming. Available at:
  https://www.anthropic.com/research/evaluating-ai-systems

- **Messick, "Validity"** (1989). In R. L. Linn (Ed.), *Educational Measurement* (3rd
  ed., pp. 13-103). The unified validity framework for psychological and educational
  testing. Dense but foundational. The six facets of construct validity are directly
  applicable to LLM evaluation. Academic text - not available online.

- **Goodhart, "Problems of Monetary Management: The UK Experience"** (1984). In A.S.
  Courakis (Ed.), *Monetary Theory and Practice*. London: Macmillan. The original
  statement of the law. Short and clear. Also see Campbell's Law (1979) for the social
  science formulation: "The more any quantitative social indicator is used for social
  decision-making, the more subject it will be to corruption pressures."

- **Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"** (2023).
  arXiv:2306.05685. NeurIPS 2023. The primary reference for LLM-as-judge methodology.
  Documents position bias, verbosity bias, self-enhancement bias. Establishes the 80%
  agreement figure between GPT-4 judge and human preferences.

- **Liang et al., "Holistic Evaluation of Language Models"** (2022). arXiv:2211.09110.
  The HELM framework: broad coverage, multi-metric measurement, standardised evaluation.
  Demonstrates the cross-lab comparison challenge - the same model scores differently
  under different prompting conventions.

- **White et al., "LiveBench: A Challenging, Contamination-Limited LLM Benchmark"**
  (2024). arXiv:2406.19314. ICLR 2025 Spotlight. The clearest example of a dynamic
  benchmark designed explicitly to resist contamination through periodic regeneration.

- **Cohen, "A coefficient of agreement for nominal scales"** (1960). *Educational and
  Psychological Measurement*, 20(1), 37-46. The original Cohen's kappa paper. Short and
  readable. Still the standard reference for inter-rater reliability measurement.

- **This project: `docs/internal/slopodar.yaml`** - The "not wrong" entry provides a
  worked example of the false negative problem in evaluation: automated checks pass,
  human reviewer rejects. The "construct drift" entry provides a worked example of
  construct validity failure detected in practice.

- **This project: `docs/internal/layer-model.md`** - L0, L3, and L12 sections provide
  the structural framework for understanding where evaluation problems originate in the
  human-AI stack.

---

## What to Read Next

**Step 2: Eval Dataset Design** - You now understand what evaluations can and cannot
tell you, and the specific failure modes that undermine measurement quality. Step 2
turns to the practical question: how do you build the data that drives an evaluation?
Dataset construction is the hardest and most resource-intensive part of evaluation
(Anthropic notes BBQ took approximately two person-years to build). Step 2 covers:
JSONL dataset format, sampling strategies, edge case design, synthetic data generation
and its limits, data versioning, and the held-out test set discipline. Every dataset
design decision is a construct validity decision - the cases you include define what
the eval measures, and the cases you exclude define what it misses.

