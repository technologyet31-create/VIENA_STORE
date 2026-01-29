let balance = 450;

function completeOrder(amount) {
    if(confirm("هل تم استلام المبلغ وتوصيل الطلب؟")) {
        balance -= amount;
        document.getElementById('pending-amount').innerText = balance + " $";
    }
}

function openCancelModal() {
    document.getElementById('cancelModal').style.display = 'flex';
}

function closeCancelModal() {
    document.getElementById('cancelModal').style.display = 'none';
}

function confirmCancel() {
    const reason = document.getElementById('cancelReason').value;
    if(reason.trim() === "") {
        alert("يرجى كتابة سبب الإلغاء");
        return;
    }
    alert("تم إلغاء الطلب لسبب: " + reason);
    closeCancelModal();
}