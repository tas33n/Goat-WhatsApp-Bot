// Global variables
let currentTab = 'dashboard';
let sidebarCollapsed = false;
let isAuthenticated = false;
let otpTimer = null;
let otpTimeLeft = 300; // 5 minutes

// Authentication functions
function showLogin() {
    document.querySelector('.login-container').style.display = 'flex';
    document.querySelector('.dashboard').style.display = 'none';
}

function showDashboard() {
    document.querySelector('.login-container').style.display = 'none';
    document.querySelector('.dashboard').style.display = 'block';
    isAuthenticated = true;
    loadDashboardData();
}

function showLoginTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all methods
    document.querySelectorAll('.login-method').forEach(method => {
        method.classList.remove('active');
    });
    
    // Add active class to clicked tab
    event.target.classList.add('active');
    
    // Show corresponding method
    document.getElementById(tabName + '-login').classList.add('active');
}

function passwordLogin() {
    const password = document.getElementById('adminPassword').value;
    if (!password) {
        showAlert('Please enter your password', 'error');
        return;
    }

    const loginBtn = document.getElementById('passwordLoginBtn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span>Logging in...';

    fetch('/api/auth/login-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('authToken', data.token);
            showDashboard();
            showAlert('Login successful!', 'success');
        } else {
            showAlert(data.message || 'Invalid password', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error during login. Please try again.', 'error');
    })
    .finally(() => {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    });
}

function requestOTP() {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Sending OTP...';

    fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showOTPForm();
            startOTPTimer();
            showAlert('OTP sent to all admins successfully!', 'success');
        } else {
            showAlert(data.message || 'Failed to send OTP', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error sending OTP. Please try again.', 'error');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Request OTP';
    });
}

function verifyOTP() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');
    
    if (otp.length !== 6) {
        showAlert('Please enter complete OTP', 'error');
        return;
    }

    const verifyBtn = document.getElementById('verifyBtn');
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="spinner"></span>Verifying...';

    fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp: otp })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('authToken', data.sessionId);
            showDashboard();
            showAlert('Login successful!', 'success');
        } else {
            showAlert(data.message || 'Invalid password', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error verifying OTP. Please try again.', 'error');
    })
    .finally(() => {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = 'Verify OTP';
    });
}

function showOTPForm() {
    document.querySelector('.phone-container').style.display = 'none';
    document.querySelector('.otp-container').style.display = 'block';
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.login-card');
    const existingAlert = container.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function startOTPTimer() {
    otpTimeLeft = 300;
    const timerElement = document.getElementById('otpTimer');
    const resendBtn = document.getElementById('resendOTP');
    
    resendBtn.style.display = 'none';
    
    otpTimer = setInterval(() => {
        const minutes = Math.floor(otpTimeLeft / 60);
        const seconds = otpTimeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (otpTimeLeft <= 0) {
            clearInterval(otpTimer);
            timerElement.textContent = '';
            resendBtn.style.display = 'inline-block';
        }
        
        otpTimeLeft--;
    }, 1000);
}

function resendOTP() {
    clearInterval(otpTimer);
    requestOTP();
}

function logout() {
    localStorage.removeItem('authToken');
    isAuthenticated = false;
    showLogin();
    // Clear OTP form
    document.querySelector('.phone-container').style.display = 'block';
    document.querySelector('.otp-container').style.display = 'none';
    document.querySelectorAll('.otp-input').forEach(input => input.value = '');
    clearInterval(otpTimer);
}

// OTP input handling
function setupOTPInputs() {
    const otpInputs = document.querySelectorAll('.otp-input');
    
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                if (index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value) {
                if (index > 0) {
                    otpInputs[index - 1].focus();
                }
            }
        });
    });
}

// Dashboard functions
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
    
    currentTab = tabName;
    loadTabData(tabName);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    sidebarCollapsed = !sidebarCollapsed;
    
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
    } else {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('expanded');
    }
}

function formatUptime(seconds) {
    const years = Math.floor(seconds / (365.25 * 24 * 3600));
    const months = Math.floor((seconds % (365.25 * 24 * 3600)) / (30.44 * 24 * 3600));
    const days = Math.floor((seconds % (30.44 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return { years, months, days, hours, minutes, seconds: secs };
}

function updateUptime() {
    if (!isAuthenticated) return;
    
    fetch('/api/system', {
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('authToken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.uptime) {
            const uptime = formatUptime(data.uptime);
            document.getElementById('uptimeYears').textContent = uptime.years;
            document.getElementById('uptimeMonths').textContent = uptime.months;
            document.getElementById('uptimeDays').textContent = uptime.days;
            document.getElementById('uptimeHours').textContent = uptime.hours;
            document.getElementById('uptimeMinutes').textContent = uptime.minutes;
            document.getElementById('uptimeSeconds').textContent = uptime.seconds;
        }
        
        if (data.memory) {
            document.getElementById('memoryUsage').textContent = Math.round(data.memory.used / 1024 / 1024) + ' MB';
        }
    })
    .catch(error => console.error('Error updating uptime:', error));
}

function loadTabData(tabName) {
    if (!isAuthenticated) return;
    
    switch(tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'bot-info':
            loadBotInfo();
            break;
        case 'commands':
            loadCommands();
            break;
        case 'users':
            loadUsers();
            break;
        case 'groups':
            loadGroups();
            break;
        case 'system':
            loadSystemInfo();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'whatsapp-auth':
            loadWhatsAppAuth();
            break;
    }
}

// WhatsApp Authentication functions
function loadWhatsAppAuth() {
    checkWhatsAppStatus();
    // Auto-refresh status every 5 seconds
    setInterval(checkWhatsAppStatus, 5000);
}

function checkWhatsAppStatus() {
    apiRequest('/api/whatsapp/auth/status')
        .then(data => {
            updateAuthStatus(data);
        })
        .catch(error => {
            console.error('Error checking WhatsApp status:', error);
            addAuthLog('Error checking WhatsApp status: ' + error.message);
        });
}

function updateAuthStatus(data) {
    const statusDot = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    
    if (data.connected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected to WhatsApp';
        addAuthLog('WhatsApp connection established');
    } else {
        statusDot.className = data.connectionStatus === 'connecting' ? 'status-dot connecting' : 'status-dot';
        statusText.textContent = data.connectionStatus === 'connecting' ? 'Connecting to WhatsApp...' : 'Disconnected from WhatsApp';
        
        if (data.lastError) {
            addAuthLog('Error: ' + data.lastError);
        }
    }
    
    // Update QR code or pairing code
    if (data.qrCode) {
        showQRCode(data.qrCode);
    } else {
        hideQRCode();
    }
    
    if (data.pairingCode) {
        showPairingCode(data.pairingCode);
    } else {
        hidePairingCode();
    }
}

function showQRCode(qrCode) {
    const container = document.getElementById('qrCodeContainer');
    const qrElement = document.getElementById('qrCode');
    
    // Check if it's already a data URL, otherwise treat as raw QR data
    if (qrCode.startsWith('data:image/')) {
        qrElement.innerHTML = `<img src="${qrCode}" alt="WhatsApp QR Code" style="max-width: 100%; height: auto;">`;
    } else {
        // For raw QR data, we'll need to generate it client-side or request it from server
        qrElement.innerHTML = `<div class="qr-placeholder">QR Code Available - Please scan with WhatsApp</div>`;
    }
    
    container.style.display = 'block';
}

function hideQRCode() {
    document.getElementById('qrCodeContainer').style.display = 'none';
}

function showPairingCode(code) {
    const container = document.getElementById('pairingCodeContainer');
    const codeElement = document.getElementById('pairingCode');
    
    codeElement.textContent = code;
    container.style.display = 'block';
}

function hidePairingCode() {
    document.getElementById('pairingCodeContainer').style.display = 'none';
}

function addAuthLog(message) {
    const logContainer = document.getElementById('authLogs');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Keep only last 50 entries
    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 50) {
        entries[0].remove();
    }
}

function startWhatsAppAuth() {
    const btn = document.getElementById('startAuthBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Starting...';
    
    apiRequest('/api/whatsapp/auth/request-code', { method: 'POST' })
        .then(data => {
            if (data.success) {
                addAuthLog('WhatsApp authentication started');
                showAlert('WhatsApp authentication started', 'success');
            } else {
                addAuthLog('Failed to start authentication: ' + data.message);
                showAlert(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error starting WhatsApp auth:', error);
            addAuthLog('Error starting authentication: ' + error.message);
            showAlert('Error starting authentication', 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-play"></i> Start Authentication';
        });
}

function disconnectWhatsApp() {
    const btn = document.getElementById('disconnectBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Disconnecting...';
    
    apiRequest('/api/whatsapp/auth/disconnect', { method: 'POST' })
        .then(data => {
            if (data.success) {
                addAuthLog('Disconnected from WhatsApp');
                showAlert('Disconnected from WhatsApp', 'success');
            } else {
                addAuthLog('Failed to disconnect: ' + data.message);
                showAlert(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error disconnecting from WhatsApp:', error);
            addAuthLog('Error disconnecting: ' + error.message);
            showAlert('Error disconnecting from WhatsApp', 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
        });
}

function restartWhatsAppAuth() {
    const btn = document.getElementById('restartAuthBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Restarting...';
    
    apiRequest('/api/whatsapp/auth/restart', { method: 'POST' })
        .then(data => {
            if (data.success) {
                addAuthLog('WhatsApp authentication restarted');
                showAlert('WhatsApp authentication restarted', 'success');
            } else {
                addAuthLog('Failed to restart authentication: ' + data.message);
                showAlert(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error restarting WhatsApp auth:', error);
            addAuthLog('Error restarting authentication: ' + error.message);
            showAlert('Error restarting authentication', 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-redo"></i> Restart Authentication';
        });
}

function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    const defaultOptions = {
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    };
    
    return fetch(endpoint, { ...defaultOptions, ...options })
        .then(response => {
            if (response.status === 401) {
                logout();
                throw new Error('Unauthorized');
            }
            return response.json();
        });
}

function loadDashboardData() {
    Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/groups'),
        apiRequest('/api/system'),
        apiRequest('/api/bot/info'),
        apiRequest('/api/analytics/overview')
    ]).then(([users, groups, system, botInfo, analytics]) => {
        // Update stats
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('totalUsers', users.total || 0);
        setText('totalGroups', groups.total || 0);
        setText('activeUsers', users.active || 0);
        setText('activeGroups', groups.active || 0);
        setText('botName', botInfo.name || 'Goat Bot');
        setText('commandsLoaded', botInfo.commandsLoaded || 0);
        if (analytics) {
            updateAnalyticsDisplay(analytics);
        }
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
    }).catch(error => {
        console.error('Error loading dashboard:', error);
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.innerHTML = '<div class="error-message">Error loading dashboard data: ' + (error.message || error) + '</div>';
            errorEl.style.display = 'block';
        }
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
    });
}

function loadBotInfo() {
    apiRequest('/api/bot/info')
        .then(data => {
            document.getElementById('botName').textContent = data.name || 'Goat Bot';
            document.getElementById('botVersion').textContent = data.version || '1.0.0';
            document.getElementById('botStatusText').textContent = data.status || 'Online';
            document.getElementById('botUptime').textContent = data.uptime || '0 seconds';
            document.getElementById('commandsLoaded').textContent = data.commandsLoaded || 0;
            document.getElementById('eventsLoaded').textContent = data.eventsLoaded || 0;
            document.getElementById('lastRestart').textContent = data.lastRestart || 'Never';
            document.getElementById('adminUsers').textContent = data.adminUsers || 0;
        })
        .catch(error => {
            console.error('Error loading bot info:', error);
            showAlert('Error loading bot information: ' + error.message, 'error');
        });
}

function loadCommands() {
    apiRequest('/api/commands')
        .then(data => {
            const commandsList = document.getElementById('commandsList');
            commandsList.innerHTML = '';
            
            if (data.commands && data.commands.length > 0) {
                data.commands.forEach(command => {
                    const commandItem = document.createElement('div');
                    commandItem.className = 'list-item';
                    commandItem.innerHTML = `
                        <div class="item-info">
                            <h6>${command.name}</h6>
                            <p>${command.description || 'No description available'}</p>
                            <small class="text-muted">Usage: ${command.usage || 'N/A'}</small>
                        </div>
                        <div class="item-badges">
                            <span class="badge command-category">${command.category || 'General'}</span>
                            ${command.role ? `<span class="badge bg-info">Role: ${command.role}</span>` : ''}
                        </div>
                    `;
                    commandsList.appendChild(commandItem);
                });
            } else {
                commandsList.innerHTML = '<div class="text-center text-muted">No commands found</div>';
            }
        })
        .catch(error => {
            console.error('Error loading commands:', error);
            document.getElementById('commandsList').innerHTML = '<div class="error-message">Error loading commands</div>';
        });
}

function loadUsers() {
    apiRequest('/api/users')
        .then(data => {
            const usersList = document.getElementById('usersList');
            usersList.innerHTML = '';
            
            if (data.users && data.users.length > 0) {
                data.users.forEach(user => {
                    const userItem = document.createElement('div');
                    userItem.className = 'list-item';
                    userItem.innerHTML = `
                        <div class="item-info">
                            <h6>${user.name || 'Unknown'}</h6>
                            <p>${user.id}</p>
                            <small class="text-muted">Exp: ${user.exp || 0} | Messages: ${user.messageCount || 0}</small>
                        </div>
                        <div class="item-badges">
                            <span class="badge bg-warning">Level ${user.level || 1}</span>
                            <span class="badge ${user.banned ? 'bg-danger' : 'bg-success'}">${user.banned ? 'Banned' : 'Active'}</span>
                            ${user.role > 0 ? `<span class="badge bg-info">Role: ${user.role}</span>` : ''}
                        </div>
                    `;
                    usersList.appendChild(userItem);
                });
            } else {
                usersList.innerHTML = '<div class="text-center text-muted">No users found</div>';
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
            document.getElementById('usersList').innerHTML = '<div class="error-message">Error loading users</div>';
        });
}

function loadGroups() {
    apiRequest('/api/groups')
        .then(data => {
            const groupsList = document.getElementById('groupsList');
            groupsList.innerHTML = '';
            
            if (data.groups && data.groups.length > 0) {
                data.groups.forEach(group => {
                    const groupItem = document.createElement('div');
                    groupItem.className = 'list-item';
                    groupItem.innerHTML = `
                        <div class="item-info">
                            <h6>${group.name || 'Unknown Group'}</h6>
                            <p>${group.id}</p>
                            <small class="text-muted">Messages: ${group.messageCount || 0}</small>
                        </div>
                        <div class="item-badges">
                            <span class="badge bg-info">${group.memberCount || 0} members</span>
                            <span class="badge ${group.isActive ? 'bg-success' : 'bg-secondary'}">${group.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    `;
                    groupsList.appendChild(groupItem);
                });
            } else {
                groupsList.innerHTML = '<div class="text-center text-muted">No groups found</div>';
            }
        })
        .catch(error => {
            console.error('Error loading groups:', error);
            document.getElementById('groupsList').innerHTML = '<div class="error-message">Error loading groups</div>';
        });
}

function loadSystemInfo() {
    apiRequest('/api/system')
        .then(data => {
            document.getElementById('platform').textContent = data.platform || 'Unknown';
            document.getElementById('architecture').textContent = data.architecture || 'Unknown';
            document.getElementById('nodeVersion').textContent = data.nodeVersion || 'Unknown';
            document.getElementById('memoryTotal').textContent = Math.round((data.memory?.total || 0) / 1024 / 1024) + ' MB';
            document.getElementById('systemMemoryUsage').textContent = Math.round((data.memory?.used || 0) / 1024 / 1024) + ' MB';
            document.getElementById('loadAverage').textContent = data.loadAverage?.join(', ') || 'N/A';
            document.getElementById('freeMemory').textContent = Math.round((data.memory?.free || 0) / 1024 / 1024) + ' MB';
        })
        .catch(error => {
            console.error('Error loading system info:', error);
            showAlert('Error loading system information: ' + error.message, 'error');
        });
}

function loadAnalytics() {
    apiRequest('/api/analytics')
        .then(data => {
            // Update analytics display
            updateAnalyticsDisplay(data);
        })
        .catch(error => {
            console.error('Error loading analytics:', error);
            showAlert('Error loading analytics: ' + error.message, 'error');
        });
}

function loadSettings() {
    apiRequest('/api/settings')
        .then(data => {
            // Update settings display
            updateSettingsDisplay(data);
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            showAlert('Error loading settings: ' + error.message, 'error');
        });
}

function updateAnalyticsDisplay(data) {
    if (!data) return;
    
    // Update charts and analytics displays
    const analyticsContainer = document.getElementById('analyticsContainer');
    if (analyticsContainer) {
        analyticsContainer.innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h6>Messages Today</h6>
                            <h3 class="text-primary">${data.messagesToday || 0}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h6>Commands Used</h6>
                            <h3 class="text-success">${data.commandsUsed || 0}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h6>Active Sessions</h6>
                            <h3 class="text-info">${data.activeSessions || 0}</h3>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

function updateSettingsDisplay(data) {
    if (!data) return;
    
    const settingsContainer = document.getElementById('settingsContainer');
    if (settingsContainer) {
        settingsContainer.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h6>Bot Configuration</h6>
                    <div class="system-metric">
                        <span class="metric-label">Prefix</span>
                        <span class="metric-value">${data.prefix || '.'}</span>
                    </div>
                    <div class="system-metric">
                        <span class="metric-label">Admin Only</span>
                        <span class="metric-value">${data.adminOnly ? 'Yes' : 'No'}</span>
                    </div>
                    <div class="system-metric">
                        <span class="metric-label">Auto Restart</span>
                        <span class="metric-value">${data.autoRestart ? 'Enabled' : 'Disabled'}</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// Search functionality
function setupSearch() {
    const searchInputs = [
        { input: 'commandSearch', container: '#commandsList .list-item' },
        { input: 'userSearch', container: '#usersList .list-item' },
        { input: 'groupSearch', container: '#groupsList .list-item' }
    ];

    searchInputs.forEach(({ input, container }) => {
        const searchInput = document.getElementById(input);
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const search = this.value.toLowerCase();
                document.querySelectorAll(container).forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(search) ? 'flex' : 'none';
                });
            });
        }
    });
}

// Authentication check
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (token) {
        fetch('/api/auth/verify', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                showDashboard();
            } else {
                localStorage.removeItem('authToken');
                showLogin();
            }
        })
        .catch(() => {
            localStorage.removeItem('authToken');
            showLogin();
        });
    } else {
        showLogin();
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    setupOTPInputs();
    setupSearch();
    checkAuth();
    
    // Auto-refresh data
    setInterval(() => {
        if (isAuthenticated) {
            updateUptime();
            if (currentTab === 'dashboard') {
                loadDashboardData();
            }
        }
    }, 30000);
    
    // Update uptime every second
    setInterval(updateUptime, 1000);
});

// Event listeners
document.getElementById('submitBtn')?.addEventListener('click', requestOTP);
document.getElementById('verifyBtn')?.addEventListener('click', verifyOTP);
document.getElementById('resendOTP')?.addEventListener('click', resendOTP);
document.getElementById('passwordLoginBtn')?.addEventListener('click', passwordLogin);
document.getElementById('logoutBtn')?.addEventListener('click', logout);

// Handle Enter key for password login
document.getElementById('adminPassword')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        passwordLogin();
    }
});

// OTP inputs - prevent non-digit input
document.querySelectorAll('.otp-input').forEach(input => {
    input.addEventListener('input', function(e) {
        this.value = this.value.replace(/\D/g, '');
    });
});

// Export functions for global access
window.showTab = showTab;
window.toggleSidebar = toggleSidebar;
window.logout = logout;
window.showLoginTab = showLoginTab;
window.startWhatsAppAuth = startWhatsAppAuth;
window.disconnectWhatsApp = disconnectWhatsApp;
window.restartWhatsAppAuth = restartWhatsAppAuth;
