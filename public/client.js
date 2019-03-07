// STEP 1: user exes out, triggering a setTimeout, which is assigned the number 1 (x)
//         also triggers an undo button, whose id is also 1 (undoCounter)

// STEP 2: if user exes out a second item, triggers a second setTimeout, which is now 2 (x)
//         and undo button for that exout has an id of 2 (undoCounter)

// STEP 3: say user wants to undo the second exout
//         second undo is pressed
//         the id of the undo button is captured from the click event (2)
//         clearTimeout(2) is called, which cancels the second exout, and restores the information

// STEP 4: say 3 seconds still has not passed, and user wants to undo first exout as well
//         first undo is pressed
//         the id of the undo button is captured from the click event (1)
//         clearTimeout(1) is called, which cancels the first exout and restores the information

// STEP 5: say user wants to exout an item and keep it exed out
//         setTimoeut is called, which is now 3 (x)
//         the id of the undo button is 3 (undoCounter)
//         after 3 seconds, setTimeout runs, which 

// counter that keeps track of which undo button we're pressing, and thus which information to repopulate
let undoCounter = 1;

// which setTimeout we're on, so we can clearTimeout for the correct information when we press "undo"
let x = 1;

// 
let num = 1;

// exout a section (needs to use document.on to account for sections which are added dynamically)
$(document).on("click", ".fa-times-circle", (e) => {

  // STEP 1: HIDE the element (so user can undo the "deletion"),
  let clickedId = e.target.id;
  console.log(e.target);
  let pollwatcher = e.target.getAttribute("data-pollwatcher");
  let sectionToHide = $("#" + clickedId).parentsUntil(".container");
  console.log(sectionToHide);
  sectionToHide.hide();

  sectionToHide.after('<button class="undo" id="undo' + undoCounter + '" style="display: block;">Undo deletion</button>');
  undoCounter++;

  console.log("first num: ", num);
  console.log("first x : ", x);
  x = setTimeout(() => {
    
    // not sure why, but this has to be called twice to work
    
    let a = $("#undo" + (undoCounter - 1));
    console.log(a);
    $("#undo" + (undoCounter - 1)).remove();
    $("#undo" + (undoCounter - 1)).remove();

    sectionToHide.remove();
    
    $.ajax({
      url: "/voted",
      data: { clickedId, pollwatcher },
      success: () => { console.log("success") },
      failure: () => { console.log("failure") }
    });
  }, 5000);
  
});

$(document).on("click", ".undo", (e) => {
  
  num = e.target.id.split("undo")[1];
  
  clearTimeout(num);
  
  // STEP 2: ADD classes back and show section again in if undo is clicked
  let clickedId = e.target.id;
  
  let prev = $("#" + clickedId).parentsUntil(".container");  
  let prevchildren = prev.children();

  prev.show();
  prevchildren.show();

  
  // I don't know why, but this needs to be called TWICE to remove the actual undo button ?????
  $("#" + clickedId).remove();
  $("#" + clickedId).remove();

});

const removeFunction = () => {
  
}