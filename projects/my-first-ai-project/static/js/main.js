function flipCard(card) {
    card.classList.toggle('flipped');
}

// 生成二次元插画
async function generateImage(poetryId, button) {
    const statusDiv = button.nextElementSibling;
    const originalText = button.textContent;
    
    // 禁用按钮并显示加载状态
    button.disabled = true;
    button.textContent = '🎨 生成中...';
    statusDiv.textContent = '正在创作卡哇伊插画,请稍候~';
    
    try {
        const response = await fetch(`/api/generate_image/${poetryId}`);
        const result = await response.json();
        
        if (result.success) {
            statusDiv.textContent = '✨ 生成成功!';
            // 刷新页面显示新图片
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            button.disabled = false;
            button.textContent = originalText;
            statusDiv.textContent = '❌ ' + result.message;
        }
    } catch (error) {
        button.disabled = false;
        button.textContent = originalText;
        statusDiv.textContent = '❌ 网络错误,请重试';
        console.error('生成图片错误:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.form.submit();
            }
        });
    }

    const cards = document.querySelectorAll('.poetry-card');
    cards.forEach(card => {
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                flipCard(this);
            }
        });
        
        card.setAttribute('tabindex', '0');
    });
});