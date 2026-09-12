const bookingForm = document.getElementById("bookingForm");
const bookingList = document.getElementById("bookingList");
const availableCount = document.getElementById("availableCount");

let editingBookingId = null;

const rooms = [
    "Sindupath", "Nilambori", "Kunjochaya", "Priyonibash",
    "Clantishese", "Joljosna", "Tondraloy",
    "Pool Villa Couple", "Pool Villa Family"
];

function getBookings() {
    const data = localStorage.getItem("resortBookings");
    return data ? JSON.parse(data) : [];
}

function saveBookings(bookings) {
    localStorage.setItem("resortBookings", JSON.stringify(bookings));
}

function datesOverlap(start1, end1, start2, end2) {
    return (start1 < end2 && end1 > start2);
}

function isRoomAvailable(room, checkIn, checkOut, excludeBookingId = null) {
    const bookings = getBookings();
    return !bookings.some(booking => {
        if (booking.status === "Cancelled") return false;
        if (excludeBookingId && booking.id === excludeBookingId) return false;
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
    bookingForm.addEventListener("submit", function(event) {
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

        // ১০ ঘণ্টা বা তার কম সময় বাকি থাকলে বুকিং বা এডিট করা ব্লক করার ভ্যালিডেশন
        const checkInTime = new Date(checkIn).getTime();
        const currentTime = new Date().getTime();
        const tenHoursInMs = 10 * 60 * 60 * 1000;

        if ((checkInTime - currentTime) < tenHoursInMs) {
            alert("দুঃখিত! চেক-ইন করার ১০ ঘণ্টার মধ্যে বা তার কম সময় বাকি থাকলে নতুন বুকিং বা পরিবর্তন করা যাবে না।");
            return;
        }

        if (!isRoomAvailable(room, checkIn, checkOut, editingBookingId)) {
            alert("Sorry! This unit is already booked for these dates.");
            return;
        }

        const bookingNumber = "INV-" + Date.now().toString().slice(-5);

        const booking = {
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

        const bookings = getBookings();
        if (editingBookingId) {
            const index = bookings.findIndex(b => b.id === editingBookingId);
            if (index !== -1) bookings[index] = booking;
            editingBookingId = null;
        } else {
            bookings.push(booking);
        }

        saveBookings(bookings);
        localStorage.setItem("lastBooking", JSON.stringify(booking));

        alert("Booking confirmed successfully!\nInvoice No: " + booking.id);
        window.open("receipt.html", "_blank");

        bookingForm.reset();
        updateRoomStatus();
        displayBookings();
    });
}

function displayBookings() {
    if (!bookingList) return;
    const bookings = getBookings();

    if (bookings.length === 0) {
        bookingList.innerHTML = `<div class="empty-booking">No bookings yet.</div>`;
        return;
    }

    bookingList.innerHTML = "";
    bookings.slice().reverse().forEach(booking => {
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
                ${booking.status !== "Cancelled" ? `<button type="button" onclick="cancelBooking('${booking.id}')" class="delete-btn">❌ Cancel</button>` : ""}
            </div>
        `;
        bookingList.appendChild(item);
    });
}

function viewReceipt(bookingId) {
    const bookings = getBookings();
    const booking = bookings.find(item => item.id === bookingId);
    if (!booking) return;
    localStorage.setItem("lastBooking", JSON.stringify(booking));
    window.open("receipt.html", "_blank");
}

function cancelBooking(bookingId) {
    const bookings = getBookings();
    const booking = bookings.find(item => item.id === bookingId);
    if (!booking) return;

    // ক্যানসেল করার ক্ষেত্রেও ১০ ঘণ্টার নিয়ম চেক করা
    const checkInTime = new Date(booking.checkIn).getTime();
    const currentTime = new Date().getTime();
    const tenHoursInMs = 10 * 60 * 60 * 1000;

    if ((checkInTime - currentTime) < tenHoursInMs) {
        alert("দুঃখিত! চেক-ইন করার ১০ ঘণ্টার মধ্যে বা তার কম সময় বাকি থাকলে বুকিং ক্যানসেল করা যাবে না।");
        return;
    }

    if (confirm("Are you sure you want to cancel invoice " + booking.id + "?")) {
        booking.status = "Cancelled";
        saveBookings(bookings);
        updateRoomStatus();
        displayBookings();
    }
}

function updateRoomStatus() {
    const roomCards = document.querySelectorAll(".room-card");
    const bookings = getBookings();
    const today = new Date().toISOString().split("T")[0];
    let available = 0;

    roomCards.forEach(card => {
        const room = card.dataset.room;
        const activeBooking = bookings.find(b => b.status !== "Cancelled" && b.room === room && b.checkIn <= today && b.checkOut > today);

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
    updateRoomStatus();
    displayBookings();
});