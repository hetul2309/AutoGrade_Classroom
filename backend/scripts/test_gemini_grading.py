from app.grading import grade_with_gemini

rubric = "1. Linear Regression implementation (50 marks)\n2. Visualization & comments (50 marks)"
desc = "Implement linear regression"
nb_text = """
import numpy as np
import matplotlib.pyplot as plt

# Linear regression implementation
X = np.array([1, 2, 3, 4, 5])
y = np.array([2, 4, 6, 8, 10])

# Fit linear model
w, b = np.polyfit(X, y, 1)
print(f"Weight: {w}, Bias: {b}")

plt.scatter(X, y, color='blue', label='Data')
plt.plot(X, w*X + b, color='red', label='Fit')
plt.legend()
plt.show()
"""

res = grade_with_gemini(
    rubric=rubric,
    task_description=desc,
    notebook_text=nb_text,
    model="gemini-2.5-flash",
    max_marks=100.0,
)

print("SUCCESS! Gemini Grade Result:")
print(f"  Marks: {res.marks} / {res.max_marks}")
print(f"  Reasoning: {res.reasoning}")
print(f"  Flagged: {res.flagged}")
