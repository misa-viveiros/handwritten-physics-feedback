# Handwritten Physics Feedback Project Notes

## Current Scope

This prototype is a local React + TypeScript + Vite app for exploring the student-facing review experience. A student can enter a physics problem statement, upload a photo of handwritten work, preview that image, and request revision-oriented feedback.

The current interface is intentionally focused on the student's own reasoning. It does not generate a full solution, assign a grade, or introduce teacher rubric controls.

## Mock Mode

Mock mode uses static TypeScript feedback examples instead of calling a vision-language model or any external API. Clicking **Analyze** currently displays the partially correct free-fall example every time.

The mock feedback includes:

- a transcription of the visible work
- an overall revision status
- strengths in the student's attempt
- the first issue to revise
- a hint
- a suggested next step
- confidence
- suggested markup notes shown near the uploaded image

## Later Additions

- VLM API call for analyzing uploaded handwritten solutions
- structured JSON validation for model responses
- optional visual annotation overlay on top of the uploaded image
- optional teacher rubric input as future work, not a current dependency
