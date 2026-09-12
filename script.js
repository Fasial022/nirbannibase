// --- FIREBASE CONFIGURATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// আপনার ফায়ারবেস কনফিগারেশন এখানে বসান
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const bookingsCollection = collection(db, "resortBookings");

// --- MAIN CODE ---
const bookingForm = document.getElementById("bookingForm");
const bookingList = document.getElementById("bookingList");
const availableCount = document.getElementById("availableCount");

let editingBookingId = null;
let globalBookings = []; // লোকাল ক্যাশ বা মেমরির জন্য

// রিয়েল-টাইম ডাটা সিঙ্ক করার জন্য ফায়ারবেস লিসেনার
function initRealtimeSync() {
    onSnapshot(bookingsCollection, (snapshot) => {
        globalBookings = [];
        snapshot.forEach((docSnap) => {
            globalBookings.push({ docId: docSnap.id, ...docSnap.data() });
        });
        updateRoomStatus();
        displayBookings();
    });
}

function datesOverlap(start1, end1, start2, end2) {
    return (start1 < end2 && end1 > start2);
}

function isRoomAvailable(room, checkIn, checkOut, excludeBookingId = null) {
    return !globalBookings.some(booking => {
        if (booking.status === "Cancelled") return false;
        if (excludeBookingId && (booking.id === excludeBookingId || booking.docId === excludeBookingId)) return false;
        if (booking.room !== room) return false;
        return datesOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut);
    });
}

function checkRooms() {
    const checkIn = document.getElementById("checkIn").value;
    const checkOut = document.getElementById("checkOut").value;

    if (!checkIn || !checkOut) {
        alert("Please select Check-in and Check-out dates.");
        return;
    }

    if (checkIn >= checkOut) {
        alert("Check-out date must be after Check-in date.");
        return;
    }

    const roomCards = document.querySelectorAll(".room-card");
    let available = 0;

    roomCards.forEach(card => {
        const room = card.dataset.room;
        if (isRoomAvailable(room, checkIn, checkOut)) {
            card.classList.remove("booked", "locked");
            card.classList.add("available");
            const status = card.querySelector(".status");
            if (status) status.textContent = "Available";
            available++;
        } else {
            card.classList.remove("available");
            card.classList.add("booked");
            const status = card.querySelector(".status");
            if (status) status.textContent = "Locked";
        }
    });

    if (availableCount) availableCount.textContent = available;
    alert(available + " unit(s) available for the selected dates.");
}

function scrollToBooking() {
    const section = document.getElementById("bookingSection");
    if (section) section.scrollIntoView({ behavior: "smooth" });
}

if (bookingForm) {
    bookingForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const customerName = document.getElementById("customerName").value.trim();
        const customerPhone = document.getElementById("customerPhone").value.trim();
        const customerAddress = document.getElementById("customerAddress").value.trim();
        const customerEmail = document.getElementById("customerEmail").value.trim();
        const customerNid = document.getElementById("customerNid").value.trim();
        
        const checkIn = document.getElementById("bookingCheckIn").value;
        const checkOut = document.getElementById("bookingCheckOut").value;
        const room = document.getElementById("roomSelect").value;
        const guests = document.getElementById("guests").value;
        const generatedBy = document.getElementById("generatedBy").value.trim();
        
        const amount = document.getElementById("amount").value;
        const discountAmount = document.getElementById("discountAmount").value || 0;
        const paidAmount = document.getElementById("paidAmount").value || 0;
        const paymentMethod = document.getElementById("paymentMethod").value;

        if (!customerName || !customerPhone || !checkIn || !checkOut || !room || !amount) {
            alert("Please fill in all required fields.");
            return;
        }

        if (checkIn >= checkOut) {
            alert("Check-out date must be after Check-in date.");
            return;
        }

        // ১০ ঘণ্টা বা তার কম সময় বাকি থাকলে বুকিং ব্লক করার ভ্যালিডেশন
        const checkInTime = new Date(checkIn).getTime();
        const currentTime = new Date().getTime();
        const tenHoursInMs = 10 * 60 * 60 * 1000;

        if ((checkInTime - currentTime) < tenHoursInMs) {
            alert("দুঃখিত! চেক-ইন করার ১০ ঘণ্টার মধ্যে বা তার কম সময় বাকি থাকলে নতুন বুকিং বা পরিবর্তন করা যাবে না।");
            return;
        }

        if (!isRoomAvailable(room, checkIn, checkOut, editingBookingId)) {
            alert("Sorry! This unit is already booked for these dates.");
            return;
        }

        const bookingNumber = "INV-" + Date.now().toString().slice(-5);

        const bookingData = {
            id: editingBookingId || bookingNumber,
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
            if (editingBookingId) {
                // ফায়ারবেসে ডাটা আপডেট করা
                const existingBooking = globalBookings.find(b => b.id === editingBookingId || b.docId === editingBookingId);
                if (existingBooking && existingBooking.docId) {
                    const docRef = doc(db, "resortBookings", existingBooking.docId);
                    await updateDoc(docRef, bookingData);
                }
                editingBookingId = null;
            } else {
                // নতুন বুকিং ফায়ারবেসে সেভ করা
                await addDoc(bookingsCollection, bookingData);
            }

            localStorage.setItem("lastBooking", JSON.stringify(bookingData));

            alert("Booking confirmed successfully!\nInvoice No: " + bookingData.id);
            window.open("receipt.html", "_blank");

            bookingForm.reset();
            updateRoomStatus();
            displayBookings();
        } catch (error) {
            console.error("Error saving booking: ", error);
            alert("Failed to save booking. Please check your internet connection.");
        }
    });
}

function displayBookings() {
    if (!bookingList) return;

    if (globalBookings.length === 0) {
        bookingList.innerHTML = `<div class="empty-booking">No bookings yet.</div>`;
        return;
    }

    bookingList.innerHTML = "";
    // রিভার্স করে দেখানো যাতে নতুন বুকিং উপরে থাকে
    [...globalBookings].reverse().forEach(booking => {
        const item = document.createElement("div");
        item.className = "booking-item";
        const statusClass = booking.status === "Cancelled" ? "cancelled" : "confirmed";
        
        const subtotal = Number(booking.amount || 0);
        const discount = Number(booking.discountAmount || 0);
        const due = (subtotal - discount) - Number(booking.paidAmount || 0);

        item.innerHTML = `
            <div class="booking-info">
                <strong>${escapeHTML(booking.customerName)} (${escapeHTML(booking.customerAddress)})</strong>
                <p>Invoice: ${escapeHTML(booking.id)} | Unit: ${escapeHTML(booking.room)}</p>
                <p>📞 ${escapeHTML(booking.customerPhone)} | 👤 Staff: ${escapeHTML(booking.generatedBy || "Mr. Shahajan")}</p>
                <p>📅 ${escapeHTML(booking.checkIn)} → ${escapeHTML(booking.checkOut)}</p>
                <p>💰 Total: ৳${subtotal} | Due: <span style="color:red; font-weight:bold;">৳${due}</span></p>
            </div>
            <div class="booking-actions">
                <span class="booking-status ${statusClass}">${escapeHTML(booking.status)}</span>
                <button type="button" onclick="viewReceipt('${booking.id}')" class="receipt-btn">🧾 Invoice</button>
                ${booking.status !== "Cancelled" ? `<button type="button" onclick="cancelBooking('${booking.docId || booking.id}')" class="delete-btn">❌ Cancel</button>` : ""}
            </div>
        `;
        bookingList.appendChild(item);
    });
}

function viewReceipt(bookingId) {
    const booking = globalBookings.find(item => item.id === bookingId);
    if (!booking) return;
    localStorage.setItem("lastBooking", JSON.stringify(booking));
    window.open("receipt.html", "_blank");
}

async function cancelBooking(identifier) {
    const booking = globalBookings.find(item => item.docId === identifier || item.id === identifier);
    if (!booking) return;

    // ক্যানসেল করার ক্ষেত্রে ১০ ঘণ্টার নিয়ম চেক করা
    const checkInTime = new Date(booking.checkIn).getTime();
    const currentTime = new Date().getTime();
    const tenHoursInMs = 10 * 60 * 60 * 1000;

    if ((checkInTime - currentTime) < tenHoursInMs) {
        alert("দুঃখিত! চেক-ইন করার ১০ ঘণ্টার মধ্যে বা তার কম সময় বাকি থাকলে বুকিং ক্যানসেল করা যাবে না।");
        return;
    }

    if (confirm("Are you sure you want to cancel invoice " + booking.id + "?")) {
        try {
            if (booking.docId) {
                const docRef = doc(db, "resortBookings", booking.docId);
                await updateDoc(docRef, { status: "Cancelled" });
            }
            updateRoomStatus();
            displayBookings();
        } catch (error) {
            console.error("Error cancelling booking: ", error);
            alert("Failed to cancel booking.");
        }
    }
}

function updateRoomStatus() {
    const roomCards = document.querySelectorAll(".room-card");
    const today = new Date().toISOString().split("T")[0];
    let available = 0;

    roomCards.forEach(card => {
        const room = card.dataset.room;
        const activeBooking = globalBookings.find(b => b.status !== "Cancelled" && b.room === room && b.checkIn <= today && b.checkOut > today);

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

    if (availableCount) availableCount.textContent = available;
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", function() {
    initRealtimeSync();
});
