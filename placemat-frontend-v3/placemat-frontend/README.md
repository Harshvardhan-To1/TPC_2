# PLACEMAT — Frontend Module
### SCSIT DAVV Campus Placement System 2025–26

---

## 📁 Folder Structure

```
placemat-frontend/
│
├── index.html                  ← Landing page (matches screenshots exactly)
│
├── student/
│   ├── login.html              ← Student login
│   └── register.html           ← Student registration
│
├── admin/
│   └── login.html              ← Admin login
│
├── company/
│   └── login.html              ← Company login + registration (tabbed)
│
└── common/
    ├── css/
    │   ├── main.css            ← Landing page styles
    │   └── auth.css            ← Shared login/register styles
    ├── js/
    │   ├── main.js             ← Typed effect, counters, modal logic
    │   └── auth.js             ← Form validation, API helpers
    └── images/                 ← 📌 PUT ALL IMAGES HERE (see below)
```

---

## 🖼️ Where to Insert Images

Search for this comment pattern in HTML files and replace with `<img>` tags:

### `index.html`

| Location | Comment | Image to use |
|---|---|---|
| Navbar logo | `INSERT LOGO IMAGE HERE` | `placemat-logo.png` – the character with briefcase + PLACEMATE text |
| Hero section | `INSERT ILLUSTRATION HERE` (hero-illus) | `hero-illustration.png` – profile card + clipboard + paper airplane |
| Section 2 | `INSERT ILLUSTRATION HERE` (signflow-illus) | `stress-free-illustration.png` – laptop, graduation cap, analytics |
| Services icons | `INSERT ICON IMAGE` (×4) | `icon-profile.png`, `icon-ai-robot.png`, `icon-resume.png`, `icon-star.png` |
| Why Choose icons | `INSERT ICON IMAGE` (×4) | `icon-track.png`, `icon-notification.png`, `icon-company.png`, `icon-ai-robot.png` |

### `student/login.html`, `admin/login.html`, `company/login.html`
| Location | Comment | Image |
|---|---|---|
| Navbar | `INSERT LOGO` | `placemat-logo.png` |

---

## 🚀 How to Run (Frontend Only)

### Option A — Simple file:// opening
Just double-click `index.html` to open in browser.
> Note: API calls will fail (no backend). Login/register forms show client-side validation only.

### Option B — With Live Server (recommended)
```bash
# Install VS Code extension "Live Server" and click "Go Live"
# OR use npx:
npx serve placemat-frontend
# Visit: http://localhost:3000
```

### Option C — Integrated with Backend
Place the `frontend/` folder inside your existing Node.js project and serve statically:
```js
app.use(express.static(path.join(__dirname, 'frontend')));
```

---

## 🔄 User Flow

```
index.html
    ↓
User clicks "Sign In" or "Sign Up"
    ↓
Role Selection Modal opens (Student / Admin / Company)
    ↓  
Student → student/login.html → student/register.html
Admin   → admin/login.html   (no self-register)
Company → company/login.html (with tab: login | register)
    ↓
After login → respective dashboard.html
```

---

## 🎨 Design Notes

- **Font**: Poppins (Google Fonts)
- **Primary Color**: `#6C5FBC` (purple)
- **Background**: `#7165C0` gradient (matching purple page bg from screenshots)
- **Cards**: White `#ffffff` with `border-radius: 22px`
- **Typed animation**: Cycles through "focus. / grow. / succeed. / shine. / excel."
- **Stat counters**: Animate on scroll into viewport
- **Modal**: Smooth scale-in animation on overlay

---

## ⚙️ API Endpoints Expected (connect to backend)

| Page | Method | Endpoint |
|---|---|---|
| Student login | POST | `/api/student/auth/login` |
| Student register | POST | `/api/student/auth/register` |
| Admin login | POST | `/api/admin/auth/login` |
| Company login | POST | `/api/company/auth/login` |
| Company register | POST | `/api/company/auth/register` |

---

Made with ❤️ | SCSIT DAVV Campus Placement Cell 2025–26
