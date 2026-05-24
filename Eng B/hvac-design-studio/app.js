/* =========================================
PRESENTATION MODE
========================================= */

const presentationButton = document.createElement("button");

presentationButton.innerText = "🎤 Presentation Mode";

presentationButton.className = "primary-btn";

presentationButton.style.position = "fixed";
presentationButton.style.right = "30px";
presentationButton.style.bottom = "30px";
presentationButton.style.zIndex = "9999";

document.body.appendChild(presentationButton);

presentationButton.addEventListener("click",()=>{

    document.body.classList.toggle("presentation-mode");

});

/* =========================================
NAVIGATION ACTIVE STATE
========================================= */

const navButtons = document.querySelectorAll(".nav-btn");

navButtons.forEach(btn=>{

    btn.addEventListener("click",()=>{

        navButtons.forEach(b=>b.classList.remove("active"));

        btn.classList.add("active");

    });

});

/* =========================================
FAKE HVAC AI RECOMMENDATIONS
========================================= */

function showRecommendation(message){

    const box = document.createElement("div");

    box.className = "panel";

    box.innerHTML = `
    
        <h2>🤖 Smart HVAC Recommendation</h2>

        <p style="
            color:#cbd5e1;
            margin-top:20px;
            line-height:1.8;
        ">
            ${message}
        </p>
    
    `;

    document.querySelector(".main-content").appendChild(box);

}

showRecommendation(
`
Increase diffuser quantity to improve airflow uniformity
and reduce NC levels in high occupancy zones.
`
);