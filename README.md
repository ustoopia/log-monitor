# Real-time Apache Log Monitor for ISPConfig

A really simple, lightweight Node.js application that monitors Apache log files in real-time for all websites hosted by ISPConfig, and shows them in a web browser, with color coding, whois lookup option, and search functionality.

## Features

- **Real-time monitoring** of Apache access and error logs
- **Multiple website support** (ISPConfig + default Apache logs)
- **Color-coded entries** for better readability
- **Search functionality** to filter displayed entries
- **Clickable IP addresses** that open WHOIS lookup in new tab
- **Auto-scrolling** with automatic cleanup (keeps latest 500 entries)
- **WebSocket-based** for real-time updates
- **Lightweight** and runs on port 8765

## Installation

### Step 1: Install nodejs and npm

```bash
# Nodejs 12.x or higher (recommended at least: 14.x+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install nodejs git

# Verify installation by showing the version
node --version
v22.16.0 (example)
```

### Step 2: Download the files from github

```bash
# Clone this repository
git clone https://github.com/ustoopia/

# Run the installer
cd log-monitor
npm install
```

The application needs to read log files from system directories, so we need permissions.

### Step 3: Set up permissions (important!)

```bash
# Add your user to the adm group (which has access to log files)
sudo usermod -a -G adm $USER

# If needed, you may need to adjust permissions for the log files
sudo chmod -R 644 /var/log/ispconfig/httpd/
sudo chmod 755 /var/log/ispconfig/httpd/

# Verify you can read the log files
ls -la /var/log/apache2/
ls -la /var/log/ispconfig/httpd/
```

**Note:** You may need to log out and back in for group changes to take effect.

### Step 4: Running the application

```bash
# In the same folder, run this:
npm start
```

You should see something that looks like this example output:
```
Log Monitor Server running on port 8765
Open http://localhost:8765 in your browser
Watching access log for example.com /var/log/ispconfig/httpd/example.com/access.log
Watching error log for example.com /var/log/ispconfig/httpd/example.com/error.log
...
```

### Step 5: Open the app in your web browser

```bash
# From your web browser, go to:
http://localhost:8765

# Or from a different device in your network:
http://YOUR-SERVER-IP:8765
```

## Usage

- **Real-time logs** appear at the top of the page
- **Search** using the search box at the top
- **Click IP addresses** to open WHOIS lookup
- **Color coding:**
  - Green border: Access logs
  - Red border: Error logs  
  - Blue: Website names
  - Orange: Timestamps
  - Pink: IP addresses
  - Green: HTTP methods
  - Various colors for HTTP status codes



## Running as a Service (Optional)

To run the log monitor as a system service:

### Step 1: Create systemd service file

```bash
sudo nano /etc/systemd/system/log-monitor.service
```

Add this content:

```ini
[Unit]
Description=Real-time Apache Log Monitor
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/log-monitor
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Note:** Make sure you change **WorkingDirectory** to where you stored the files.

### Step 2: Enable and start the service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable log-monitor

# Start the service
sudo systemctl start log-monitor

# Check service status
sudo systemctl status log-monitor
```

## Troubleshooting

### Permission Issues
If you get permission denied errors:
```bash
# Check if you can read the log files
sudo ls -la /var/log/apache2/
sudo ls -la /var/log/ispconfig/httpd/

# If needed, temporarily run with sudo to test
sudo npm start
```

### Port Already in Use
If port 8765 is already in use, edit `server.js` and change:
```javascript
const PORT = 8765;   // Change to any other port, like 8766
```

### No Log Entries Appearing
1. Check if log files exist and have recent entries
2. Verify file permissions
3. Check the server console for error messages
4. Test with `tail -f /var/log/apache2/access.log` to see if logs are being written

### WebSocket Connection Issues
If you see "Disconnected" in the browser:
1. Check if the server is running
2. Verify firewall allows port 8765
3. Check browser console for errors

## Customization

You can customize the application by editing:

- **Colors and styling**: Modify the CSS in `index.html`
- **Log parsing**: Update the regex patterns in `server.js`
- **WHOIS service**: Change the WHOIS URL in the `openWhois()` function
- **Maximum entries**: Change `MAX_ENTRIES` in `server.js`

## Security Notes

- This application is designed for internal use only!
- It is not recommended to expose this to the internet!
- Make sure to at least set up authentication if exposing to the internet
- The application runs with the permissions of the user who starts it
- Log files may contain sensitive information

## Performance

- Memory usage is limited by the MAX_ENTRIES setting (default: 500)
- CPU usage is minimal as it only processes new log entries
- Network usage depends on log volume and number of connected browsers
