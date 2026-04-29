# Bugs


# Features

### Pomodoro
- we should be able to select a task in pomdoro page, it should be on top of pomodoroContainer, having a sort of select where its searchable to find our task. We should show a dropdown with CourseCodeBadge on the left (as a optional input), and show the title of the task on the right on a different searchable input select (if CourseCodeBadge not selected, we search on all the tasks of the user). We can either select the course code, then the task, OR the task directly. CourseCode should take smaller space then task.
Once we selected a task, and completed (or partially completed, as long as we click the pause/reset button) a pomdoro, we can call the pomodoro complete endpoint and passing the task id.
    - pomodoro page should be able to receive duration and task id in query params. Add task title in the UI on top of pomodoroContainer. We should be able to change task from there and uncheck task to not count in the pomodoro.
- Add github-like calendar to track pomodoro activity
- use pomodoroDaily table instead of attributes in user table to track daily pomodoro count
### Kanban Board
- Implement GitHub-like Kanban board (TODO, IN PROGRESS, COMPLETED) (5 points)
