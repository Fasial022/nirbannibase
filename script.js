import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION & INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBpzarkWv2eTOL69jGU1IFHQnaDO3Cw_mw",
    authDomain: "nirbannibashresort-7c73f.firebaseapp.com",
    projectId: "nirbannibashresort-7c73f",
    storageBucket: "nirbannibashresort-7c73f.firebasestorage.app",
    messagingSenderId: "83312527640",
    appId: "1:83312527640:web:8c4570fd1bf23bfa69b66d",
    measurementId: "G-6693Y09Z05"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const bookingsCollection = collection(db, "resortBookings");

let globalBookings = [];
let salesChartInstance = null;

// --- REALTIME FIREBASE SYNC ---
function initRealtimeSync() {
    onSnapshot(bookingsCollection, (snapshot) => {
        globalBookings = [];
        snapshot.forEach((docSnap) => {
            globalBookings.push({ docId: docSnap.id, ...docSnap.data() });
        });
        
        updateRoomStatus();
        displayBookings();
        updateFinancialSummary();
        renderChart();
    }, (error) => {
        console.error("Firebase Sync Error:", error);
    });
}

// --- UTILITY FUNCTIONS ---
function datesOverlap(start1, end1, start2, end2) {
    return (start1 < end2 && end1 > start2);
}

function isRoomAvailable(room, checkIn, checkOut, excludeDocId = null) {
    return !globalBookings.some(booking => {
        if (booking.status === "Cancelled" || booking.status === "CANCELLED") return false;
        if (excludeDocId && (booking.docId === excludeDocId || booking.id === excludeDocId)) return false;
        if (booking.room !== room) return false;
        return datesOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut);
    });
}

function isWithinTenHours(checkInDateString) {
    if (!checkInDateString) return false;
    const [year, month, day] = checkInDateString.split('-').map(Number);
    const checkInTime = new Date(year, month - 1, day, 0, 0, 0).getTime();
    const currentTime = Date.now();
    const tenHoursInMs = 10 * 60 * 60 * 1000;

    return (checkInTime - currentTime) < tenHoursInMs;
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- GLOBAL WINDOW FUNCTIONS ---

// রুমের এভেলেবিলিটি চেক
window.checkRooms = function() {
    const checkInInput = document.getElementById("checkIn");
    const checkOutInput = document.getElementById("checkOut");

    if (!checkInInput || !checkOutInput) return;

    const checkIn = checkInInput.value;
    const checkOut = checkOutInput.value;

    if (!checkIn || !checkOut) {
        alert("Please select both Check-in and Check-out dates.");
        return;
    }

    if (checkIn >= checkOut) {
        alert("Check-out date must be after Check-in date.");
        return;
    }

    const roomCards = document.querySelectorAll(".room-card");
    let availableCount = 0;

    roomCards.forEach(card => {
        const roomName = card.dataset.room;
        const statusEl = card.querySelector(".status");

        if (isRoomAvailable(roomName, checkIn, checkOut)) {
            card.classList.remove("booked", "locked");
            card.classList.add("available");
            if (statusEl) statusEl.textContent = "Available";
            availableCount++;
        } else {
            card.classList.remove("available");
            card.classList.add("booked", "locked");
            if (statusEl) statusEl.textContent = "Locked";
        }
    });

    const availDisplay = document.getElementById("availableCount");
    if (availDisplay) availDisplay.textContent = availableCount;

    alert(`${availableCount} unit(s) available for selected dates.`);
};

// রসিদ/ইনভয়েস ভিউ
window.viewReceipt = function(docId) {
    const booking = globalBookings.find(item => item.docId === docId || item.id === docId);
    if (!booking) {
        alert("Invoice details not found!");
        return;
    }
    localStorage.setItem("lastBooking", JSON.stringify(booking));
    window.open("receipt.html", "_blank");
};

// বুকিং ক্যানসেল
window.cancelBooking = async function(docId) {
    const booking = globalBookings.find(item => item.docId === docId || item.id === docId);
    if (!booking) return;

    if (isWithinTenHours(booking.checkIn)) {
        alert("দুঃখিত! চেক-ইন করার ১০ ঘণ্টার মধ্যে বা তার কম সময় বাকি থাকলে বুকিং ক্যানসেল করা যাবে না।");
        return;
    }

    const invId = booking.id || booking.docId;
    if (confirm(`Are you sure you want to cancel booking (${invId})?`)) {
        try {
            if (booking.docId) {
                const docRef = doc(db, "resortBookings", booking.docId);
                await updateDoc(docRef, { status: "Cancelled" });
            }
            alert("Booking cancelled successfully.");
        } catch (error) {
            console.error("Error cancelling booking: ", error);
            alert("Failed to cancel booking.");
        }
    }
};

// --- DASHBOARD AND DOM RENDERERS ---

function updateRoomStatus() {
    const roomCards = document.querySelectorAll(".room-card");
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    let available = 0;

    roomCards.forEach(card => {
        const room = card.dataset.room;
        const activeBooking = globalBookings.find(b => 
            b.status !== "Cancelled" && 
            b.status !== "CANCELLED" && 
            b.room === room && 
            b.checkIn <= today && 
            b.checkOut > today
        );

        const status = card.querySelector(".status");
        if (activeBooking) {
            card.classList.remove("available");
            card.classList.add("booked");
            if (status) status.textContent = "Locked";
        } else {
            card.classList.remove("booked");
            card.classList.add("available");
            if (status) status.textContent = "Available";
            available++;
        }
    });

    const availableCount = document.getElementById("availableCount");
    if (availableCount) availableCount.textContent = available;
}

function displayBookings() {
    const bookingList = document.getElementById("bookingList");
    if (!bookingList) return;

    if (globalBookings.length === 0) {
        bookingList.innerHTML = `<div class="empty-booking">No bookings yet.</div>`;
        return;
    }

    bookingList.innerHTML = "";
    [...globalBookings].reverse().forEach(booking => {
        const item = document.createElement("div");
        item.className = "booking-item";
        
        const isCancelled = booking.status === "Cancelled" || booking.status === "CANCELLED";
        const statusClass = isCancelled ? "cancelled" : "confirmed";
        
        const subtotal = Number(booking.amount || 0);
        const discount = Number(booking.discountAmount || 0);
        const paid = Number(booking.paidAmount || 0);
        const due = (subtotal - discount) - paid;
        
        const targetDocId = booking.docId || booking.id;

        item.innerHTML = `
            <div class="booking-info">
                <strong>${escapeHTML(booking.customerName || 'N/A')} (${escapeHTML(booking.customerAddress || 'N/A')})</strong>
                <p>Invoice: ${escapeHTML(booking.id || booking.docId)} | Unit: ${escapeHTML(booking.room)}</p>
                <p>📞 ${escapeHTML(booking.customerPhone)} | 👤 Staff: ${escapeHTML(booking.generatedBy || "Mr. Tajbi")}</p>
                <p>📅 ${escapeHTML(booking.checkIn)} → ${escapeHTML(booking.checkOut)}</p>
                <p>💰 Total: ৳${subtotal} | Discount: ৳${discount} | Paid: ৳${paid} | Due: <span style="color:red; font-weight:bold;">৳${due}</span></p>
            </div>
            <div class="booking-actions">
                <span class="booking-status ${statusClass}">${escapeHTML(booking.status || 'Booked')}</span>
                <button type="button" onclick="viewReceipt('${targetDocId}')" class="receipt-btn">🧾 Invoice</button>
                ${!isCancelled ? `<button type="button" onclick="cancelBooking('${targetDocId}')" class="delete-btn">❌ Cancel</button>` : ""}
            </div>
        `;
        bookingList.appendChild(item);
    });
}

function updateFinancialSummary() {
    let totalSales = 0;
    let totalAdvance = 0;
    let totalDue = 0;
    let activeBookingsCount = 0;

    globalBookings.forEach(b => {
        if (b.status !== "Cancelled" && b.status !== "CANCELLED") {
            activeBookingsCount++;
            const amt = Number(b.amount || 0);
            const disc = Number(b.discountAmount || 0);
            const paid = Number(b.paidAmount || 0);
            const net = amt - disc;

            totalSales += net;
            totalAdvance += paid;
            totalDue += (net - paid);
        }
    });

    const elCount = document.getElementById("totalBookingsCount");
    const elSales = document.getElementById("totalSalesAmount");
    const elAdvance = document.getElementById("totalAdvanceAmount");
    const elDue = document.getElementById("totalDueAmount");

    if (elCount) elCount.textContent = activeBookingsCount;
    if (elSales) elSales.textContent = totalSales.toLocaleString();
    if (elAdvance) elAdvance.textContent = totalAdvance.toLocaleString();
    if (elDue) elDue.textContent = totalDue.toLocaleString();
}

function renderChart() {
    const canvas = document.getElementById("salesChart");
    if (!canvas) return;

    let sales = 0;
    let advance = 0;
    let due = 0;

    globalBookings.forEach(b => {
        if (b.status !== "Cancelled" && b.status !== "CANCELLED") {
            const amt = Number(b.amount || 0);
            const disc = Number(b.discountAmount || 0);
            const paid = Number(b.paidAmount || 0);
            const net = amt - disc;

            sales += net;
            advance += paid;
            due += (net - paid);
        }
    });

    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total Net Sales', 'Total Advance Paid', 'Total Due Amount'],
            datasets: [{
                label: 'Financial Breakdown (BDT ৳)',
                data: [sales, advance, due],
                backgroundColor: ['#28a745', '#17a2b8', '#dc3545'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Overall Financial Summary' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// --- DOM READY EVENT & FORM SUBMISSION ---
document.addEventListener("DOMContentLoaded", function() {
    const bookingForm = document.getElementById("bookingForm");

    if (bookingForm) {
        bookingForm.addEventListener("submit", async function(e) {
            e.preventDefault();

            const customerName = document.getElementById("customerName")?.value.trim();
            const customerPhone = document.getElementById("customerPhone")?.value.trim();
            const customerAddress = document.getElementById("customerAddress")?.value.trim();
            const customerEmail = document.getElementById("customerEmail")?.value.trim();
            const customerNid = document.getElementById("customerNid")?.value.trim();
            const checkIn = document.getElementById("bookingCheckIn")?.value;
            const checkOut = document.getElementById("bookingCheckOut")?.value;
            const room = document.getElementById("roomSelect")?.value;
            const guests = document.getElementById("guests")?.value;
            const generatedBy = document.getElementById("generatedBy")?.value.trim();
            const amount = document.getElementById("amount")?.value;
            const discountAmount = document.getElementById("discountAmount")?.value || 0;
            const paidAmount = document.getElementById("paidAmount")?.value || 0;
            const paymentMethod = document.getElementById("paymentMethod")?.value;

            if (!customerName || !customerPhone || !checkIn || !checkOut || !room || !amount) {
                alert("Please fill in all required fields.");
                return;
            }

            if (checkIn >= checkOut) {
                alert("Check-out date must be after Check-in date.");
                return;
            }

            if (isWithinTenHours(checkIn)) {
                alert("দুঃখিত! চেক-ইন করার ১০ ঘণ্টার মধ্যে বা তার কম সময় বাকি থাকলে নতুন বুকিং তৈরি করা যাবে না।");
                return;
            }

            if (!isRoomAvailable(room, checkIn, checkOut)) {
                alert("Sorry! This unit is already booked for these selected dates.");
                return;
            }

            const bookingNumber = "INV-" + Date.now().toString().slice(-5);

            const bookingData = {
                id: bookingNumber,
                customerName,
                customerPhone,
                customerAddress,
                customerEmail,
                customerNid,
                checkIn,
                checkOut,
                room,
                guests,
                generatedBy,
                amount,
                discountAmount,
                paidAmount,
                paymentMethod,
                status: "Booked",
                bookingDate: new Date().toLocaleString()
            };

            try {
                const docRef = await addDoc(bookingsCollection, bookingData);
                bookingData.docId = docRef.id;

                localStorage.setItem("lastBooking", JSON.stringify(bookingData));

                alert("Booking confirmed successfully!\nInvoice No: " + bookingData.id);
                window.open("receipt.html", "_blank");

                bookingForm.reset();
            } catch (error) {
                console.error("Error adding booking: ", error);
                alert("Failed to confirm booking. Please try again.");
            }
        });
    }

    initRealtimeSync();
});
