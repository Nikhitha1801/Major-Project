# Attendance System (Attendify)

FastAPI + SQLite backend, React + Vite + Tailwind frontend. Role-based portals for
Admin, HOD, Faculty and Student, with automatic multi-face attendance.

## Your data is safe
- The database is always `backend/attendify.db`, no matter which folder you start the server from.
- Registered faces live in `backend/face_uploads/` and `backend/face_model/gallery.npz`.
- Restarting the server or the frontend never deletes anything.
- `python seed.py` is the ONLY thing that wipes data. It refuses to run if users already exist
  unless you type `YES` in capital letters. Run it once, on first setup, and never again.

## First-time setup (Windows PowerShell)
    cd backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    python seed.py                      # ONCE only
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

    # second terminal
    cd frontend
    npm install
    npm run dev                         # open the printed http://localhost:5173

## Every day after that
Only the two start commands (uvicorn, npm run dev). Do not run seed.py again.

Login (all accounts): password `Attendify@123`
admin@gsssietw.edu | hod.cse@gsssietw.edu | faculty1@gsssietw.edu | student@gsssietw.edu

## Face recognition
- Detector: SCRFD (InsightFace buffalo_s `det_500m.onnx`) - finds every face in the frame at once.
- Recognizer: MobileFaceNet / ArcFace (`w600k_mbf.onnx`) - 512-d embeddings, cosine matching.
- Both models are bundled in `backend/face_model/models/` and run on CPU via onnxruntime.
- A face is accepted only if its similarity clears 0.45 AND beats the runner-up student by 0.06;
  anyone not registered shows as "Unknown" instead of being forced onto the closest student.
- Liveness: a face must show natural movement/blinks across capture cycles. A still photo is flagged
  "suspected_photo" and never marked present (a video replayed on a phone can still fool this).
- Students register 3+ photos from their Student portal (Face Registration) before they can be recognized.
- For 10+ faces use a 1080p camera mounted so faces are at least ~40 px wide in the frame.

## Android IP Webcam
- Connect the phone running IP Webcam and the computer running the backend to the same Wi-Fi network, then start the camera server in the phone app.
- On the faculty dashboard, enter the snapshot link shown by IP Webcam (usually `http://PHONE_IP:8080/shot.jpg`) and connect before starting class. The address is used for that attendance session and is not saved.
- The computer running the backend must be able to reach the phone. Otherwise, leave the link blank and use the browser's local camera.
- Choose 1080p in the IP Webcam app and frame the room so each face is at least about 40 px wide. All visible faces are detected in each snapshot, but only enrolled students with a confident match are named; uncertain faces remain Unknown.

## Automatic attendance (Classroom Kiosk)
Open `/kiosk` once on the classroom PC and pick the room. Capture starts by itself at
class start + 15 min, runs 15 min, then marks absentees and emails the faculty report.
Timing is adjustable in Admin -> Settings. Email needs SMTP details in `backend/.env`
(copy `.env.example`).
