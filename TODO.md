# Bugs
- use pomodoroDaily table instead of attributes in user table to track daily pomodoro count

# Features

### Pomodoro
- we should be able to select a task in pomdoro page, it should be on top of pomodoroContainer, having a sort of select where its searchable to find our task. We should show a dropdown with CourseCodeBadge on the left (as a optional input), and show the title of the task on the right on a different searchable input select (if CourseCodeBadge not selected, we search on all the tasks of the user). We can either select the course code, then the task, OR the task directly. CourseCode should take smaller space then task.
Once we selected a task, and completed (or partially completed, as long as we click the pause/reset button) a pomdoro, we can call the pomodoro complete endpoint and passing the task id.
    - pomodoro page should be able to receive duration and task id in query params. Add task title in the UI on top of pomodoroContainer. We should be able to change task from there and uncheck task to not count in the pomodoro.
- Add github-like calendar to track pomodoro activity

### Kanban Board
- Implement GitHub-like Kanban board (TODO, IN PROGRESS, COMPLETED) (5 points)

### Tech debt
- Add a proper state manager to avoid prop drilling shenanigans


# Tests
### Task Management Testing
- Test add task (1 point)
- Test remove task (1 point)
- Test edit task (change date, title, subtasks) (3 points)
- Test change task status (2 points)
- Test Pomodoro effort tracking (user and task tables) (3 points)
- Test add subtasks (1 point)
- Test remove subtasks (1 point)
- Test edit subtasks (2 points)

### Story: API and Middleware Testing
- Test cron API and `cron-secret` route for deleting courses (3 points)
- Test middleware using sensitive API endpoints (2 points)

### Story: Course Management Testing
- Test remove course (1 point)
- Test task creation upon course addition (2 points)
