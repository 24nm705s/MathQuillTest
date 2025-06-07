class MathQuillEditor {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = {
            spaceBehavesLikeTab: true,
            leftRightIntoCmdGoes: 'up',
            restrictMismatchedBrackets: true,
            sumStartsWithNEquals: true,
            supSubsRequireOperand: true,
            charsThatBreakOutOfSupSub: '+-=<>',
            autoSubscriptNumerals: true,
            autoCommands: 'pi e sqrt',
            autoOperatorNames: 'sin cos tan sec csc cot sinh cosh tanh sech csch coth arcsin arccos arctan arcsec arccsc arccot ln log exp',
            enableMobileSupport: true,
            enableLogging: false,
            logContainer: null,
            ...options
        };
        
        this.mathField = null;
        this.hiddenInput = null;
        this.focusInterval = null;
        this.userIntentionallyBlurred = false;
        this.isComposing = false;
        this.lastInputValue = '';
        this.logCount = 0;
        this.logContainer = null;
        
        this.init();
    }
    
    init() {
        if (typeof MathQuill === 'undefined') {
            throw new Error('MathQuill is not loaded. Please include MathQuill library.');
        }
        
        this.createMathField();
        if (this.options.enableMobileSupport) {
            this.createHiddenInput();
            this.setupMobileSupport();
        }
        this.setupEventListeners();
        
        if (this.options.enableLogging) {
            this.setupLogging();
        }
        
        this.log('system', 'MathQuillEditor初期化完了');
    }
    
    createMathField() {
        const MQ = MathQuill.getInterface(2);
        const handlers = {
            edit: (field) => {
                this.log('edit', `LaTeX: ${field.latex()}`);
                if (this.options.onEdit) this.options.onEdit(field);
            },
            enter: (field) => {
                this.log('enter', `LaTeX: ${field.latex()}`);
                if (this.options.onEnter) this.options.onEnter(field);
            },
            upOutOf: (field) => {
                this.log('upOutOf', `LaTeX: ${field.latex()}`);
                if (this.options.onUpOutOf) this.options.onUpOutOf(field);
            },
            downOutOf: (field) => {
                this.log('downOutOf', `LaTeX: ${field.latex()}`);
                if (this.options.onDownOutOf) this.options.onDownOutOf(field);
            },
            selectOutOf: (field) => {
                this.log('selectOutOf', `LaTeX: ${field.latex()}`);
                if (this.options.onSelectOutOf) this.options.onSelectOutOf(field);
            },
            deleteOutOf: (field) => {
                this.log('deleteOutOf', `LaTeX: ${field.latex()}`);
                if (this.options.onDeleteOutOf) this.options.onDeleteOutOf(field);
            }
        };
        
        this.mathField = MQ.MathField(this.container, {
            spaceBehavesLikeTab: this.options.spaceBehavesLikeTab,
            leftRightIntoCmdGoes: this.options.leftRightIntoCmdGoes,
            restrictMismatchedBrackets: this.options.restrictMismatchedBrackets,
            sumStartsWithNEquals: this.options.sumStartsWithNEquals,
            supSubsRequireOperand: this.options.supSubsRequireOperand,
            charsThatBreakOutOfSupSub: this.options.charsThatBreakOutOfSupSub,
            autoSubscriptNumerals: this.options.autoSubscriptNumerals,
            autoCommands: this.options.autoCommands,
            autoOperatorNames: this.options.autoOperatorNames,
            handlers: handlers
        });
    }
    
    createHiddenInput() {
        this.hiddenInput = document.createElement('input');
        this.hiddenInput.type = 'text';
        this.hiddenInput.id = 'mathquill-hidden-input-' + Date.now();
        this.hiddenInput.style.cssText = `
            position: absolute;
            left: -9999px;
            top: -9999px;
            opacity: 0;
            pointer-events: none;
            width: 1px;
            height: 1px;
            font-size: 16px;
            border: none;
            outline: none;
            background: transparent;
        `;
        this.hiddenInput.setAttribute('autocomplete', 'off');
        this.hiddenInput.setAttribute('autocorrect', 'off');
        this.hiddenInput.setAttribute('autocapitalize', 'off');
        this.hiddenInput.setAttribute('spellcheck', 'false');
        
        document.body.appendChild(this.hiddenInput);
        this.setupHiddenInputEvents();
    }
    
    setupHiddenInputEvents() {
        this.hiddenInput.addEventListener('keydown', (e) => {
            this.log('hiddenInput-keydown', `key: ${e.key || 'undefined'}, code: ${e.code || 'undefined'}`);
            
            if (this.isComposing) return;
            
            const keyMap = {
                'Backspace': 'Backspace',
                'Delete': 'Del',
                'Enter': 'Enter',
                'ArrowLeft': 'Left',
                'ArrowRight': 'Right',
                'ArrowUp': 'Up',
                'ArrowDown': 'Down'
            };
            
            if (keyMap[e.key]) {
                e.preventDefault();
                this.mathField.keystroke(keyMap[e.key]);
                this.log('hiddenInput-keystroke', `${e.key} 実行`);
                return;
            }
            
            if (e.key.length > 1 && !['Space', 'Tab'].includes(e.key)) {
                return;
            }
        });
        
        this.hiddenInput.addEventListener('input', (e) => {
            const currentValue = this.hiddenInput.value;
            
            if (currentValue && currentValue !== this.lastInputValue) {
                let newChars = '';
                if (currentValue.length > this.lastInputValue.length) {
                    newChars = currentValue.substring(this.lastInputValue.length);
                } else {
                    newChars = currentValue;
                    if (this.lastInputValue) {
                        for (let i = 0; i < this.lastInputValue.length; i++) {
                            this.mathField.keystroke('Backspace');
                        }
                    }
                }
                
                if (newChars) {
                    this.log('hiddenInput', `リアルタイム入力: "${newChars}"`);
                    this.mathField.write(newChars);
                }
                
                this.lastInputValue = currentValue;
                
                if (!this.isComposing) {
                    this.hiddenInput.value = '';
                    this.lastInputValue = '';
                }
            }
        });
        
        this.hiddenInput.addEventListener('compositionstart', () => {
            this.isComposing = true;
            this.lastInputValue = this.hiddenInput.value;
            this.log('hiddenInput-compositionstart', 'IME入力開始');
        });
        
        this.hiddenInput.addEventListener('compositionend', () => {
            this.isComposing = false;
            this.log('hiddenInput-compositionend', `IME入力終了: "${this.hiddenInput.value}"`);
            
            const finalValue = this.hiddenInput.value;
            if (finalValue !== this.lastInputValue) {
                if (this.lastInputValue) {
                    for (let i = 0; i < this.lastInputValue.length; i++) {
                        this.mathField.keystroke('Backspace');
                    }
                }
                if (finalValue) {
                    this.mathField.write(finalValue);
                }
            }
            
            this.hiddenInput.value = '';
            this.lastInputValue = '';
        });
        
        this.hiddenInput.addEventListener('focus', () => {
            this.log('hiddenInput-focus', '隠しinputがフォーカス');
        });
        
        this.hiddenInput.addEventListener('blur', () => {
            this.log('hiddenInput-blur', '隠しinputがブラー');
            if (this.isMobile() && !this.userIntentionallyBlurred) {
                setTimeout(() => {
                    if (!this.userIntentionallyBlurred) {
                        this.log('hiddenInput-auto-focus', 'MathFieldに自動フォーカス復帰');
                        this.mathField.focus();
                    }
                }, 100);
            }
        });
    }
    
    setupMobileSupport() {
        this.container.addEventListener('touchstart', (e) => {
            this.log('touchstart', 'スマホタッチ検出');
            e.preventDefault();
            this.userIntentionallyBlurred = false;
            setTimeout(() => {
                this.mathField.focus();
            }, 100);
        });
        
        this.container.addEventListener('focusin', () => {
            this.log('mathField-focusin', 'MathField内でフォーカス');
            this.userIntentionallyBlurred = false;
            if (this.isMobile()) {
                clearInterval(this.focusInterval);
                this.focusInterval = setInterval(() => {
                    if (document.activeElement !== this.hiddenInput && !this.userIntentionallyBlurred) {
                        this.hiddenInput.focus();
                    }
                }, 500);
            }
        });
        
        this.container.addEventListener('focusout', () => {
            this.log('mathField-focusout', 'MathFieldからフォーカスアウト');
            this.userIntentionallyBlurred = true;
            clearInterval(this.focusInterval);
        });
        
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target) && (!this.hiddenInput || !this.hiddenInput.contains(e.target))) {
                this.log('external-click', 'MathField外をクリック');
                setTimeout(() => {
                    this.userIntentionallyBlurred = true;
                    clearInterval(this.focusInterval);
                }, 50);
            }
        });
        
        document.addEventListener('touchstart', (e) => {
            if (!this.container.contains(e.target) && (!this.hiddenInput || !this.hiddenInput.contains(e.target))) {
                this.log('external-touch', 'MathField外をタッチ');
                setTimeout(() => {
                    this.userIntentionallyBlurred = true;
                    clearInterval(this.focusInterval);
                }, 50);
            }
        });
    }
    
    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            this.log('click', 'クリック検出');
            e.preventDefault();
            this.userIntentionallyBlurred = false;
            this.mathField.focus();
        });
        
        const events = ['keydown', 'keyup', 'input', 'focus', 'blur', 'compositionstart', 'compositionend'];
        events.forEach(eventType => {
            this.container.addEventListener(eventType, (e) => {
                let detail = `${eventType} event fired`;
                if (['keydown', 'keyup'].includes(eventType)) {
                    detail = `key: ${e.key !== undefined ? e.key : 'undefined'}, code: ${e.code || 'undefined'}`;
                } else if (eventType === 'compositionend') {
                    detail = `IME composition ended: "${e.data || ''}"`;
                }
                this.log(eventType, detail);
            });
        });
    }
    
    setupLogging() {
        if (this.options.logContainer) {
            this.logContainer = typeof this.options.logContainer === 'string' 
                ? document.getElementById(this.options.logContainer) 
                : this.options.logContainer;
        }
    }
    
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
    }
    
    log(type, detail) {
        if (this.options.enableLogging && this.logContainer) {
            this.logCount++;
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = `<span class="log-number">${this.logCount}.</span> <span class="log-time">[${new Date().toLocaleTimeString()}]</span> <span class="log-event">${type}</span>: <span class="log-detail">${detail}</span>`;
            this.logContainer.appendChild(entry);
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
        
        if (this.options.onLog) {
            this.options.onLog(type, detail, this.logCount);
        }
    }
    
    // Public API methods
    getLatex() {
        return this.mathField.latex();
    }
    
    setLatex(latex) {
        this.mathField.latex(latex);
        return this;
    }
    
    focus() {
        this.mathField.focus();
        return this;
    }
    
    blur() {
        this.mathField.blur();
        return this;
    }
    
    clear() {
        this.mathField.latex('');
        return this;
    }
    
    write(text) {
        this.mathField.write(text);
        return this;
    }
    
    keystroke(key) {
        this.mathField.keystroke(key);
        return this;
    }
    
    clearLog() {
        if (this.logContainer) {
            this.logContainer.innerHTML = '';
            this.logCount = 0;
            this.log('system', 'ログをクリアしました');
        }
        return this;
    }
    
    destroy() {
        if (this.focusInterval) {
            clearInterval(this.focusInterval);
        }
        if (this.hiddenInput && this.hiddenInput.parentNode) {
            this.hiddenInput.parentNode.removeChild(this.hiddenInput);
        }
        this.mathField = null;
        this.hiddenInput = null;
    }
    
    // Helper method to get available auto commands and operators
    getAutoCommands() {
        return this.options.autoCommands.split(' ').filter(cmd => cmd.trim() !== '');
    }
    
    getAutoOperatorNames() {
        return this.options.autoOperatorNames.split(' ').filter(op => op.trim() !== '');
    }
    
    // Method to add custom auto commands
    addAutoCommands(commands) {
        if (typeof commands === 'string') {
            this.options.autoCommands += ' ' + commands;
        } else if (Array.isArray(commands)) {
            this.options.autoCommands += ' ' + commands.join(' ');
        }
        this.log('addAutoCommands', `追加されたコマンド: ${commands}`);
        return this;
    }
    
    // Method to add custom auto operator names
    addAutoOperatorNames(operators) {
        if (typeof operators === 'string') {
            this.options.autoOperatorNames += ' ' + operators;
        } else if (Array.isArray(operators)) {
            this.options.autoOperatorNames += ' ' + operators.join(' ');
        }
        this.log('addAutoOperatorNames', `追加された演算子: ${operators}`);
        return this;
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MathQuillEditor;
} else if (typeof window !== 'undefined') {
    window.MathQuillEditor = MathQuillEditor;
}
