# Faculty Timetable

An LMS-style faculty timetable with an administration panel. Starts empty; add classes through Administration.

## Run checks

Requires Node.js 24 or later.

    npm test
    npm run build

Hosted through Sites with a D1 database. The deployment platform supplies authenticated identity headers. Keep the deployed site owner-private: all signed-in visitors admitted by the platform can manage classes.

No example records are seeded. Tests use an isolated in-memory database.
