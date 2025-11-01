function initSearch() {
  const searchInput = document.getElementById('feed-search');
  const itemsContainer = document.getElementById('feed-items');
  const originalItems = itemsContainer.innerHTML;
  
  searchInput.addEventListener('input', async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    if (!searchTerm) {
      itemsContainer.innerHTML = originalItems;
      return;
    }

    try {
      const response = await fetch('/json/');
      const feedData = await response.json();
      
      const filteredItems = feedData.items.filter(item => {
        const title = (item.title || '').toLowerCase();
        const content = (item.content_text || '').toLowerCase();
        return title.includes(searchTerm) || content.includes(searchTerm);
      });

      if (filteredItems.length === 0) {
        itemsContainer.innerHTML = '<div class="mb-4">No items found matching your search.</div>';
        return;
      }

      const itemsHtml = filteredItems.map(item => `
        <div class="mb-4">
          <a href="${item._microfeed.web_url}" class="mb-1">
            ${item.title}
            <span class="icon-arrow-right"></span>
          </a>
          <div class="text-sm">
            ${item._microfeed.date_published_short}
            ${item._microfeed.duration_hhmmss ? `
              &middot;
              <i>${item._microfeed.duration_hhmmss}</i>
            ` : ''}
          </div>
        </div>
      `).join('');

      itemsContainer.innerHTML = itemsHtml;
    } catch (error) {
      console.error('Error fetching search results:', error);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}