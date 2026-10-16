// Keep layout tidy for photos not added yet
document.querySelectorAll("img").forEach(img => {
  const mark = () => img.classList.add("missing");
  if (img.complete && !img.naturalWidth) mark(); else img.addEventListener("error", mark);
});

// Click a photo to view it larger
const box = document.querySelector(".lightbox");
const big = box.querySelector("img");
document.querySelectorAll(".photos img, .project img, .portrait img").forEach(img => {
  img.addEventListener("click", () => {
    if (img.classList.contains("missing")) return;
    big.src = img.src; box.hidden = false;
  });
});
box.addEventListener("click", () => (box.hidden = true));
document.addEventListener("keydown", e => { if (e.key === "Escape") box.hidden = true; });
