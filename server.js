const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 8765;
const MAX_ENTRIES = 500;

// Store log entries in memory
let logEntries = [];

// Serve static files
app.use(express.static('.'));

// Function to parse Apache access log entry
function parseAccessLog(line, website) {
    // Apache common/combined log format
    const regex = /^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d+) (\S+)(?: "([^"]*)" "([^"]*)")?/;
    const match = line.match(regex);
    
    if (!match) return null;
    
    const [, ip, datetime, request, status, size, referer, userAgent] = match;
    
    return {
        website,
        type: 'access',
        ip,
        datetime,
        request,
        status: parseInt(status),
        size,
        referer: referer || '-',
        userAgent: userAgent || '-',
        raw: line,
        timestamp: new Date()
    };
}

// Function to parse Apache error log entry
function parseErrorLog(line, website) {
    // Apache error log format varies, but typically starts with timestamp
    const timestampRegex = /^\[([^\]]+)\]/;
    const match = line.match(timestampRegex);
    
    return {
        website,
        type: 'error',
        datetime: match ? match[1] : 'Unknown',
        message: line,
        raw: line,
        timestamp: new Date()
    };
}

// Function to add log entry
function addLogEntry(entry) {
    logEntries.unshift(entry); // Add to beginning
    
    // Keep only MAX_ENTRIES
    if (logEntries.length > MAX_ENTRIES) {
        logEntries = logEntries.slice(0, MAX_ENTRIES);
    }
    
    // Emit to all connected clients
    io.emit('newLogEntry', entry);
}

// Function to watch a single log file
function watchLogFile(filePath, website, type) {
    console.log(`Watching ${type} log for ${website}: ${filePath}`);
    
    let lastSize = 0;
    
    try {
        const stats = fs.statSync(filePath);
        lastSize = stats.size;
    } catch (err) {
        console.log(`File doesn't exist yet: ${filePath}`);
        return;
    }
    
    const watcher = chokidar.watch(filePath, {
        persistent: true,
        usePolling: true,
        interval: 1000
    });
    
    watcher.on('change', () => {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size > lastSize) {
                const stream = fs.createReadStream(filePath, {
                    start: lastSize,
                    encoding: 'utf8'
                });
                
                let buffer = '';
                stream.on('data', (chunk) => {
                    buffer += chunk;
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer
                    
                    lines.forEach(line => {
                        if (line.trim()) {
                            let entry;
                            if (type === 'access') {
                                entry = parseAccessLog(line, website);
                            } else {
                                entry = parseErrorLog(line, website);
                            }
                            
                            if (entry) {
                                addLogEntry(entry);
                            }
                        }
                    });
                });
                
                stream.on('end', () => {
                    lastSize = stats.size;
                });
            }
        } catch (err) {
            console.error(`Error reading ${filePath}:`, err.message);
        }
    });
}

// Function to discover and watch all log files
function setupLogWatchers() {
    const ispConfigPath = '/var/log/ispconfig/httpd/';
    const apache2Path = '/var/log/apache2/';
    
    // Watch ISPConfig logs
    try {
        const websites = fs.readdirSync(ispConfigPath);
        websites.forEach(website => {
            const websitePath = path.join(ispConfigPath, website);
            if (fs.statSync(websitePath).isDirectory()) {
                const accessLogPath = path.join(websitePath, 'access.log');
                const errorLogPath = path.join(websitePath, 'error.log');
                
                watchLogFile(accessLogPath, website, 'access');
                watchLogFile(errorLogPath, website, 'error');
            }
        });
        console.log(`Found ${websites.length} websites to monitor`);
    } catch (err) {
        console.error('Error reading ISPConfig directory:', err.message);
    }
    
    // Watch Apache2 default logs
    try {
        watchLogFile(path.join(apache2Path, 'access.log'), 'apache2-default', 'access');
        watchLogFile(path.join(apache2Path, 'error.log'), 'apache2-default', 'error');
    } catch (err) {
        console.error('Error setting up Apache2 log watchers:', err.message);
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send existing log entries to new client
    socket.emit('initialLogs', logEntries);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Log Monitor Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    
    // Setup log watchers
    setupLogWatchers();
});
