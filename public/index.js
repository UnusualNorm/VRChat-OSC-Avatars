const columns = document.getElementsByClassName('column');
function insertAvatar(element) {
  const targetColumn = Array.from(columns).reduce(
    (a, b) => (a.childElementCount <= b.childElementCount ? a : b),
    columns[0]
  );
  targetColumn.append(element);
}

function createAvatar(avatarName, avatarImage, avatarLink) {
  /*
  <div class="container avatar zoom">
    <img
      src="https://api.lorem.space/image/face?w=150&h=150"
      alt="Avatar"
      class="image"
    />
    <div class="overlay">John</div>
  </div>
  */
  const container = document.createElement('div');
  container.classList.add('container');
  container.classList.add('avatar');
  container.classList.add('zoom');

  const image = document.createElement('img');
  image.src = avatarImage;
  image.alt = 'Avatar';
  image.classList.add('image');

  const overlay = document.createElement('div');
  overlay.classList.add('overlay');
  overlay.innerText = avatarName;

  container.onclick = () => (location.href = avatarLink);

  container.append(image);
  container.append(overlay);
  return container;
}

// for (let i = 0; i < 6; i++) {
//   insertAvatar(
//     createAvatar(
//       'John',
//       'https://api.lorem.space/image/face?w=150&h=150',
//       '/test'
//     )
//   );
// }

(async function () {
  const avatars = await (await fetch('/avatars.json')).json();
  avatars.forEach((avatar) =>
    insertAvatar(createAvatar(avatar.name, avatar.image, avatar.link))
  );
})();
