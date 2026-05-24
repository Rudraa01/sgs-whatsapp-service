# Shree Glamour Studio — WhatsApp Gateway Microservice

A production-ready Node.js microservice designed to act as an OTP and message gateway using `whatsapp-web.js` (Express + Puppeteer). It is fully optimized for cloud deployment on **Railway.app** or **Render.com**.

---

## 🚀 GitHub Upload Steps

To host this repository on GitHub so it can be deployed directly to Railway:

1. **Initialize Git repository** inside `sgs-whatsapp-service` folder:
   ```bash
   cd sgs-whatsapp-service
   git init
   ```
2. **Add all files to staging**:
   ```bash
   git add .
   ```
3. **Commit your files**:
   ```bash
   git commit -m "feat: initial production-ready release of sgs-whatsapp-service"
   ```
4. **Create a new repository** on GitHub (e.g., `sgs-whatsapp`).
5. **Rename branch to main** and push the code:
   ```bash
   git branch -M main
   git remote add origin https://github.com/your-username/sgs-whatsapp.git
   git push -u origin main
   ```

---

## ☁️ Railway.app Deployment Steps

Railway uses **Nixpacks** to build the environment. It will automatically detect the Node.js project, install the dependencies, and configure the necessary Google Chrome/Chromium dependencies for Puppeteer to run in a headless environment.

1. **Log in** to your [Railway.app](https://railway.app) account.
2. Click **New Project** -> **Deploy from GitHub repository**.
3. Select your repository `sgs-whatsapp`.
4. Click **Deploy Now**.
5. Once deployment is initiated:
   * Go to the service **Settings** tab.
   * Under **Networking**, click **Generate Domain** (to get your public URL, e.g. `https://sgs-whatsapp-production.up.railway.app`).
6. **QR Scan & Pairing**:
   * Open the generated URL with `/qr` suffix in your browser (e.g. `https://your-app-domain.up.railway.app/qr`).
   * Scan the QR code displayed using your phone's WhatsApp (Linked Devices -> Link a Device).
   * Once scanned, the service state will shift to **Connected**.
7. **Keep Alive Trick**:
   * To prevent the Railway container from going to sleep on free tiers, you can configure a free service ping tool like [UptimeRobot](https://uptimerobot.com) to ping `https://your-app-domain.up.railway.app/status` every 5 minutes.

---

## 🛠️ API Endpoint Documentation

The microservice runs by default on port `4500` (or `process.env.PORT` on cloud environments).

### 1. Get Service Status
* **Endpoint:** `GET /status`
* **Response:**
  ```json
  {
    "status": "connected",
    "qr": null
  }
  ```

### 2. View/Scan QR Code
* **Endpoint:** `GET /qr`
* **Description:** Open this directly in your web browser to scan the QR code and link your phone.

### 3. Send OTP Message
* **Endpoint:** `POST /send-otp`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "phone": "919876543210",
    "message": "Your OTP code is 482910. Valid for 10 minutes."
  }
  ```
* **Response:**
  ```json
  {
    "success": true
  }
  ```

### 4. Send Message (Laravel Compatibility Endpoint)
* **Endpoint:** `POST /send-message`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "to": "919876543210",
    "message": "Hello from Shree Glamour Studio!"
  }
  ```
* **Response:**
  ```json
  {
    "success": true
  }
  ```

### 5. Control Endpoints (For Admin Dashboard)
* `POST /connect` — Initiates the browser connection.
* `POST /disconnect` — Logs out the WhatsApp session.
* `POST /restart` — Destroys the current process, deletes the session folder, and requests a fresh QR code.

---

## ⚙️ Environment Configuration in Laravel

Open the `.env` file of your Laravel application on Hostinger and set the URL of your deployed Railway app:

```env
WHATSAPP_SERVICE_URL=https://sgs-whatsapp-production.up.railway.app
```
