// MildMate Shop Manager - Client Application Logic

let activeListings = [];
let selectedListing = null;
let currentImages = [];
let originalInventory = null; // Holds full Etsy inventory structure to rebuild PUT payload

// 1. Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const isLinked = await checkAuthStatus();
  if (isLinked) {
    loadListings();
  } else {
    const listEl = document.getElementById("listingsList");
    listEl.innerHTML = `
      <li style="padding:20px; text-align:center; color:#64748b;">
        Please link your Etsy account to display listings.
      </li>
    `;
  }
  setupEventListeners();
});

// 2. Check Etsy Connection status
async function checkAuthStatus() {
  const statusBadge = document.getElementById("etsyConnection");
  try {
    const res = await fetch("/api/auth/status");
    const data = await res.json();

    if (data.authenticated) {
      statusBadge.textContent = "Etsy Linked";
      statusBadge.className = "status-badge connected";
      statusBadge.title = "Click to reconnect or change accounts";
      statusBadge.onclick = () => {
        if (confirm("Would you like to reconnect/re-authorize your Etsy account?")) {
          window.location.href = "/api/auth/login";
        }
      };
      return true;
    } else {
      statusBadge.textContent = "Link Etsy Account";
      statusBadge.className = "status-badge disconnected";
      statusBadge.onclick = () => {
        window.location.href = "/api/auth/login";
      };
      return false;
    }
  } catch (err) {
    statusBadge.textContent = "API Check Offline";
    statusBadge.className = "status-badge disconnected";
    return false;
  }
}

// 3. Load listings from D1 Cache
async function loadListings(refresh = false) {
  const listEl = document.getElementById("listingsList");
  listEl.innerHTML = `<li style="padding:20px; text-align:center; color:#64748b;">Loading listings...</li>`;

  try {
    const url = refresh ? "/api/listings?refresh=true" : "/api/listings";
    const res = await fetch(url);
    
    if (res.status === 401) {
      listEl.innerHTML = `
        <li style="padding:20px; text-align:center; color:#b91c1c;">
          Authentication Required. Please click 'Link Etsy Account' at the top.
        </li>
      `;
      return;
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    activeListings = data;
    renderListings(activeListings);
  } catch (err) {
    listEl.innerHTML = `
      <li style="padding:20px; text-align:center; color:#ef4444;">
        <p style="margin-bottom:10px;">Error: ${escapeHtml(err.message)}</p>
        <button type="button" style="padding:8px 14px; background:#ef4444; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer;" onclick="window.location.href='/api/auth/login'">
          Reconnect Etsy Account
        </button>
      </li>
    `;
  }
}

// 4. Render listings list in sidebar
function renderListings(items) {
  const listEl = document.getElementById("listingsList");
  if (items.length === 0) {
    listEl.innerHTML = `<li style="padding:20px; text-align:center; color:#64748b;">No matching listings found.</li>`;
    return;
  }

  listEl.innerHTML = items
    .map(item => {
      const activeClass = selectedListing && selectedListing.etsy_listing_id === item.etsy_listing_id ? "active" : "";
      const dateStr = item.last_synced ? new Date(item.last_synced).toLocaleDateString() : "Never Cached";
      return `
        <li class="sidebar-item ${activeClass}" onclick="selectListing('${item.etsy_listing_id}')">
          <h3>${escapeHtml(item.title)}</h3>
          <div class="meta">
            <span>ID: ${item.etsy_listing_id}</span>
            <span>Synced: ${dateStr}</span>
          </div>
        </li>
      `;
    })
    .join("");
}

// 5. Select listing and load into form
async function selectListing(id) {
  const placeholder = document.getElementById("placeholderView");
  const editor = document.getElementById("editorView");
  
  placeholder.style.display = "none";
  editor.style.display = "block";

  // Mark sidebar item as active
  document.querySelectorAll(".sidebar-item").forEach(item => item.classList.remove("active"));
  const clicked = activeListings.find(l => l.etsy_listing_id === id);
  renderListings(activeListings); // Rerenders to show active class cleanly

  // Fetch full listing details (including variations) from D1/Etsy
  editor.style.opacity = "0.5";
  try {
    const res = await fetch(`/api/listings?id=${id}`);
    const data = await res.json();
    
    selectedListing = data;
    editor.style.opacity = "1";
    
    // Populate form fields
    document.getElementById("etsyListingId").value = data.etsy_listing_id;
    document.getElementById("listingTitle").value = data.title;
    document.getElementById("listingDescription").value = data.description;
    document.getElementById("listingPrice").value = data.price;
    document.getElementById("listingTags").value = data.tags || "";
    
    // Images
    currentImages = data.images ? JSON.parse(data.images) : [];
    renderImages();
    
    // Parse variations
    originalInventory = data.variations ? JSON.parse(data.variations) : null;
    renderVariationsTable(originalInventory);
    updateTagsCount();
  } catch (err) {
    showToast("Error loading listing details: " + err.message, "error");
    editor.style.opacity = "1";
  }
}

// 6. Parse and render the Etsy variations table (GET /inventory payload format)
function renderVariationsTable(inventory) {
  const section = document.getElementById("variationsSection");
  const headerTr = document.getElementById("variationsTableHeader");
  const bodyTbody = document.getElementById("variationsTableBody");

  if (!inventory || !inventory.products || inventory.products.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  bodyTbody.innerHTML = "";

  // A. Determine variation dimensions (e.g. "Size" and/or "Fabric")
  // Fetch property names from first product values
  const firstProd = inventory.products[0];
  const dimensionNames = firstProd.property_values.map(pv => pv.property_name);

  // Set up headers
  headerTr.innerHTML = dimensionNames.map(dName => `<th>${escapeHtml(dName)}</th>`).join("") + 
    `<th>Price (USD)</th><th>Quantity</th><th>SKU</th>`;

  // B. Render a row for each variation offering combo
  inventory.products.forEach((product, idx) => {
    // Collect combo values (e.g. ["US Twin (68\"x86\")", "PremaCotton"])
    const comboValues = product.property_values.map(pv => pv.values[0] || "");
    const offering = product.offerings[0] || {};
    
    const priceAmount = offering.price ? offering.price.amount / offering.price.divisor : selectedListing.price;
    const qty = offering.quantity !== undefined ? offering.quantity : 10;
    const sku = product.sku || "";

    const tr = document.createElement("tr");
    tr.dataset.productIndex = idx; // Link back to original array element

    tr.innerHTML = comboValues.map(val => `<td><strong>${escapeHtml(val)}</strong></td>`).join("") + `
      <td><input type="number" step="0.01" value="${priceAmount.toFixed(2)}" class="var-price" data-idx="${idx}"></td>
      <td><input type="number" value="${qty}" class="var-qty" data-idx="${idx}"></td>
      <td><input type="text" value="${escapeHtml(sku)}" class="var-sku" data-idx="${idx}" maxlength="50"></td>
    `;
    bodyTbody.appendChild(tr);
  });
}

// 7. Render images uploader preview grid
function renderImages() {
  const grid = document.getElementById("imageGrid");
  grid.innerHTML = currentImages
    .map((imgUrl, idx) => `
      <div class="image-card">
        <img src="${imgUrl}" alt="Listing Image">
        <button type="button" class="remove-btn" onclick="removeImage(${idx})">&times;</button>
      </div>
    `)
    .join("");
}

function removeImage(idx) {
  currentImages.splice(idx, 1);
  renderImages();
}

// 8. Event Listeners setup
function setupEventListeners() {
  // Sync button
  document.getElementById("refreshList").addEventListener("click", () => {
    loadListings(true);
    checkAuthStatus();
  });

  // Logout button
  document.getElementById("logoutBtn").addEventListener("click", () => {
    document.cookie = "admin_auth=; path=/; max-age=0";
    window.location.href = "/login.html";
  });

  // Search input
  document.getElementById("searchListings").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = activeListings.filter(l => 
      l.title.toLowerCase().includes(query) || 
      l.etsy_listing_id.includes(query)
    );
    renderListings(filtered);
  });

  // Form submit (save updates)
  document.getElementById("editForm").addEventListener("submit", handleFormSubmit);

  // Tags remaining count tracker
  document.getElementById("listingTags").addEventListener("input", updateTagsCount);

  // R2 Drag & Drop image files upload setup
  const dropzone = document.getElementById("imageDropzone");
  
  dropzone.addEventListener("click", () => document.getElementById("fileInput").click());
  
  document.getElementById("fileInput").addEventListener("change", (e) => {
    uploadFiles(e.target.files);
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    uploadFiles(e.dataTransfer.files);
  });
}

// 9. Upload images to Cloudflare R2
async function uploadFiles(files) {
  if (!files || files.length === 0) return;

  for (const file of files) {
    const toast = showToast(`Uploading ${file.name}...`, "info");
    
    try {
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: {
          "Content-Type": file.type
        },
        body: file
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      currentImages.push(data.url);
      renderImages();
      showToast("Uploaded successfully!", "success");
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, "error");
    }
  }
}

// 10. Update listing on Save
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("etsyListingId").value;
  const title = document.getElementById("listingTitle").value;
  const description = document.getElementById("listingDescription").value;
  const price = parseFloat(document.getElementById("listingPrice").value);
  const tagsText = document.getElementById("listingTags").value;
  const syncToEtsy = document.getElementById("syncToEtsy").checked;

  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  // A. Rebuild variations inventory payload if variations exist
  let variationsStr = null;
  if (originalInventory && originalInventory.products) {
    const updatedInventory = JSON.parse(JSON.stringify(originalInventory));
    
    // Map changed input fields back to JSON structure
    const priceInputs = document.querySelectorAll(".var-price");
    const qtyInputs = document.querySelectorAll(".var-qty");
    const skuInputs = document.querySelectorAll(".var-sku");

    updatedInventory.products.forEach((product, idx) => {
      const pInput = Array.from(priceInputs).find(input => parseInt(input.dataset.idx) === idx);
      const qInput = Array.from(qtyInputs).find(input => parseInt(input.dataset.idx) === idx);
      const sInput = Array.from(skuInputs).find(input => parseInt(input.dataset.idx) === idx);

      const priceVal = parseFloat(pInput.value);
      const qtyVal = parseInt(qInput.value);
      const skuVal = sInput.value.trim();

      // Etsy expects price in cents/divisor format
      if (product.offerings && product.offerings[0]) {
        product.offerings[0].price.amount = Math.round(priceVal * 100);
        product.offerings[0].price.divisor = 100;
        product.offerings[0].quantity = qtyVal;
      }
      product.sku = skuVal;
    });

    variationsStr = JSON.stringify(updatedInventory);
  }

  // B. Make PUT request to Worker
  const payload = {
    etsy_listing_id: id,
    title,
    description,
    price,
    tags: tagsText,
    images: JSON.stringify(currentImages),
    variations: variationsStr,
    sync_to_etsy: syncToEtsy
  };

  try {
    const res = await fetch("/api/listings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    showToast(syncToEtsy ? "Saved and Synced successfully to Etsy!" : "Saved changes locally!", "success");
    loadListings(); // Rerender list in sidebar
  } catch (err) {
    showToast("Save failed: " + err.message, "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save changes";
  }
}

// 11. Helper: Update remaining tags counter
function updateTagsCount() {
  const val = document.getElementById("listingTags").value;
  const count = val ? val.split(",").map(t => t.trim()).filter(Boolean).length : 0;
  const rem = 13 - count;
  
  const countEl = document.getElementById("tagsCount");
  countEl.textContent = rem;
  countEl.style.color = rem < 0 ? "#ef4444" : "#64748b";
}

// 12. Helper: Toast notifications uploader
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

// 13. Helper: Clean rendering strings
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
