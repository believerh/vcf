# CypherX VCF Contact Manager

A contact form application that collects member contacts and exports them to VCF format with admin controls.

## Features

- Collect contacts (name, phone) via web form
- Auto-format phone numbers to +233 format
- vCard 4.0 export with deduplication
- Admin dashboard to manage contacts
- Rate limiting (10 submissions per 15 minutes)
- Download tracking statistics
- Reset all contacts functionality

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
PORT=3000
ADMIN_PASSWORD=your_secure_password
```

3. Start the server:
```bash
npm start
# or for development
npm run dev
```

## Deployment

Deploy to Railway by connecting your GitHub repository. The app will auto-start.

## Usage

- **Homepage:** Visit `/` to view the registration form
- **Admin:** Visit `/admin?password=your_secure_password`
- **Download:** Enable download in admin, then visit `/download.vcf`

## Phone Number Format

- Numbers starting with `0` are converted to `+233`
- Other numbers get `+` prefix added automatically
- Example: `0534970884` → `+233534970884`