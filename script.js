// ===== 全局变量 =====
// 当前版本不依赖后端，只在本地浏览器中保存留言
const LOCAL_MESSAGE_KEY = 'github_messages_v1';

// ===== DOM 加载完成后执行 =====
document.addEventListener('DOMContentLoaded', function() {
  initNavigation();
  initScrollEffects();
  initContactForm();
  initMessageBoard();
  initBackToTop();
  initAnimations();
  initRedirectAnimation(); // 初始化跳转动画
  initMouseLineEffect(); // 鼠标移动连线特效
});

// ===== 导航栏功能 =====
function initNavigation() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  // 滚动时改变导航栏样式
  window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 移动端菜单切换
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      navMenu.classList.toggle('active');
      hamburger.classList.toggle('active');
    });
  }

  // 点击导航链接后关闭移动端菜单
  navLinks.forEach(link => {
    link.addEventListener('click', function() {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
    });
  });

  // 平滑滚动
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      
      if (targetSection) {
        const offsetTop = targetSection.offsetTop - 70;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ===== 滚动效果 =====
function initScrollEffects() {
  const sections = document.querySelectorAll('.section');
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  sections.forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
  });
}

// ===== 联系表单（不依赖后端）=====
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const name = this.name.value;
      const email = this.email.value;
      const message = this.message.value;

      console.log('[联系表单] 本地收集到的数据:', { name, email, message });
      showNotification('消息已记录（本地演示，不会发送到服务器）', 'success');
      this.reset();
    });
  }
}

// ===== 留言板功能（本地存储版，不依赖后端）=====
function initMessageBoard() {
  const messageForm = document.getElementById('githubMessageForm');
  
  if (messageForm) {
    // 提交留言
    messageForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const newMessage = {
        name: this.name.value,
        email: this.email.value,
        content: this.content.value,
        // 使用时间戳，渲染时统一按北京时间显示
        createTime: Date.now()
      };

      console.log('[留言提交] 本地保存留言:', newMessage);

      let messages = [];
      try {
        const raw = localStorage.getItem(LOCAL_MESSAGE_KEY);
        messages = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(messages)) messages = [];
      } catch (e) {
        messages = [];
      }

      messages.unshift(newMessage);
      localStorage.setItem(LOCAL_MESSAGE_KEY, JSON.stringify(messages));

      showNotification('留言已保存（仅当前浏览器可见）', 'success');
      this.reset();
      renderMessages(messages);
    });

    // 页面加载时从本地加载留言
    loadMessages();
  }
}

// ===== 从本地加载留言 =====
function loadMessages() {
  let messages = [];
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGE_KEY);
    messages = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(messages)) messages = [];
  } catch (e) {
    messages = [];
  }

  renderMessages(messages);
}

// ===== 渲染留言列表 =====
function renderMessages(messages) {
  const messageList = document.getElementById('githubMessageList');
  const messageCount = document.getElementById('githubMessageCount');
  
  if (!messageList) return;

  messageList.innerHTML = '';

  if (!messages || messages.length === 0) {
    messageList.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">暂无留言，快来成为第一个留言的人吧！（仅当前浏览器保存）</p>';
    if (messageCount) {
      messageCount.textContent = '0';
    }
    return;
  }

  if (messageCount) {
    messageCount.textContent = messages.length;
  }

  // 渲染每条留言
  messages.forEach(msg => {
    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';
    
    // 格式化时间（按北京时间显示）
    let formatTime = '';
    if (msg.createTime) {
      let date;
      if (typeof msg.createTime === 'number') {
        date = new Date(msg.createTime);
      } else {
        // 兼容之前可能保存过的字符串格式
        date = new Date(msg.createTime);
      }
      if (!isNaN(date.getTime())) {
        try {
          formatTime = date.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            hour12: false
          });
        } catch (e) {
          formatTime = date.toLocaleString();
        }
      }
    }
    
    messageItem.innerHTML = `
      <p><strong>${escapeHtml(msg.name)}</strong> <span style="color: #999; font-size: 0.9rem;">(${escapeHtml(msg.email)})</span></p>
      <p>${escapeHtml(msg.content)}</p>
      ${formatTime ? `<p class="message-time">${formatTime}</p>` : ''}
    `;

    messageItem.style.opacity = '0';
    messageItem.style.transform = 'translateY(10px)';
    messageItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    messageList.appendChild(messageItem);

    requestAnimationFrame(() => {
      messageItem.style.opacity = '1';
      messageItem.style.transform = 'translateY(0)';
    });
  });
}

// ===== 返回顶部按钮 =====
function initBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');
  
  if (backToTopBtn) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

// ===== 动画效果 =====
function initAnimations() {
  // 技能卡片动画
  const skillCards = document.querySelectorAll('.skill-card');
  skillCards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
  });

  // 项目卡片动画
  const projectCards = document.querySelectorAll('.project-card');
  projectCards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.15}s`;
  });
}

// ===== 跳转动画功能 =====
function initRedirectAnimation() {
  const projectLinks = document.querySelectorAll('.project-link');
  const overlay = document.getElementById('redirect-overlay');
  
  if (projectLinks.length > 0 && overlay) {
    projectLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        // 阻止默认跳转
        e.preventDefault();
        
        // 显示遮罩层
        overlay.classList.add('active');
        
        // 获取目标URL
        const targetUrl = this.getAttribute('href');
        
        // 1.5秒后跳转
        setTimeout(() => {
          window.open(targetUrl, '_blank');
          // 动画播放完成后隐藏遮罩层
          setTimeout(() => {
            overlay.classList.remove('active');
          }, 500);
        }, 1500);
      });
    });
  }
}

// ===== 鼠标拖尾霓虹丝带（不影响点击）=====
function initMouseLineEffect() {
  // 用户偏好：减少动态效果时直接关闭
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'mouse-line-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999;
  `;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  const state = {
    trail: [],
    maxPoints: 45,
    lifeMs: 700,
    minStep: 6,
    lastX: null,
    lastY: null
  };

  function resize() {
    const ratio = dpr();
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function pushPoint(x, y) {
    const now = Date.now();
    if (state.lastX !== null) {
      const dx = x - state.lastX;
      const dy = y - state.lastY;
      if (dx * dx + dy * dy < state.minStep * state.minStep) return;
    }
    state.lastX = x;
    state.lastY = y;

    state.trail.unshift({ x, y, t: now });
    if (state.trail.length > state.maxPoints) state.trail.length = state.maxPoints;
  }

  window.addEventListener(
    'mousemove',
    (e) => pushPoint(e.clientX, e.clientY),
    { passive: true }
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches && e.touches[0];
      if (t) pushPoint(t.clientX, t.clientY);
    },
    { passive: true }
  );

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function drawSmoothPath(points) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const n = points[i + 1];
      const cx = (p.x + n.x) / 2;
      const cy = (p.y + n.y) / 2;
      ctx.quadraticCurveTo(p.x, p.y, cx, cy);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function frame() {
    const now = Date.now();
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 清理过期点
    const life = state.lifeMs;
    state.trail = state.trail.filter(p => now - p.t <= life);

    const pts = state.trail;
    if (pts.length < 2) {
      requestAnimationFrame(frame);
      return;
    }

    // 把点做一次“衰减重采样”，让尾巴更自然
    const sampled = [];
    for (let i = 0; i < pts.length; i++) {
      const age = now - pts[i].t;
      const a = 1 - age / life;
      if (a <= 0) continue;
      // 越靠近尾部越稀疏
      if (i > 8 && i % 2 === 1) continue;
      sampled.push(pts[i]);
    }
    if (sampled.length < 2) {
      requestAnimationFrame(frame);
      return;
    }

    const head = sampled[0];
    const tail = sampled[sampled.length - 1];

    // 渐变霓虹（蓝紫 -> 粉）
    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    grad.addColorStop(0, 'rgba(236, 72, 153, 0.9)');   // pink
    grad.addColorStop(1, 'rgba(99, 102, 241, 0.75)');  // indigo

    // 先画柔光外圈
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawSmoothPath(sampled);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.12;
    ctx.filter = 'blur(6px)';
    ctx.stroke();

    // 再画主体线条（随时间变细、变淡）
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    for (let pass = 0; pass < 2; pass++) {
      drawSmoothPath(sampled);
      ctx.strokeStyle = grad;
      ctx.lineWidth = pass === 0 ? 4 : 2;
      ctx.globalAlpha = pass === 0 ? 0.55 : 0.9;
      ctx.stroke();
    }

    // 头部光点
    const headAge = now - head.t;
    const headA = Math.max(0, 1 - headAge / life);
    ctx.beginPath();
    ctx.arc(head.x, head.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(236, 72, 153, ${0.35 * headA})`;
    ctx.fill();

    ctx.restore();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ===== 工具函数 =====

// 显示通知
function showNotification(message, type = 'success') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // 添加样式
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
    max-width: 400px;
    word-wrap: break-word;
  `;
  
  document.body.appendChild(notification);
  
  // 3秒后自动移除
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// HTML转义，防止XSS攻击
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== 添加通知动画样式 =====
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);


// 联系表单已在 initContactForm() 中统一处理，此处不再重复绑定
