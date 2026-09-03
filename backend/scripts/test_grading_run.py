import asyncio
import os
from app.pipeline import run_grading_pipeline

async def main():
    print("Running grading pipeline for Assignment ID: 73...")
    state = await run_grading_pipeline(assignment_id=73, direct_execution=True)
    print("\nGrading Pipeline Execution Result:")
    print("Completed:", state.get("completed"))
    print("Errors:", state.get("errors"))
    print("Submissions processed:", len(state.get("submission_states", {})))
    for sid, sinfo in state.get("submission_states", {}).items():
        print(f"  Submission ID {sid}: Marks={sinfo.get('marks')} | Flagged={sinfo.get('flagged')} | Reasoning={sinfo.get('reasoning')}")

if __name__ == "__main__":
    asyncio.run(main())
