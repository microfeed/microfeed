import React, { useEffect, useState } from "react"

const Header = ({ menuItems, activeLink }) => {
  const [isSticky, setIsSticky] = useState(false);
  const [isTogglerActive, setIsTogglerActive] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const headerNavbar = document.querySelector(".navbar-area");
      if (headerNavbar) {
        const sticky = headerNavbar.offsetTop;
        setIsSticky(window.pageYOffset > sticky)
      }
    };

    window.document.addEventListener('scroll', onScroll, { passive: true });
    return () => window.document.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="header">
      <div className={`navbar-area ${isSticky && "sticky"}`}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-12">
              <nav className="navbar navbar-expand-lg">
                <a className="navbar-brand" href="https://buttercms.com">
                  <img src="https://cdn.buttercms.com/PBral0NQGmmFzV0uG7Q6" alt="Logo" />
                </a>
                <button className={`navbar-toggler ${isTogglerActive ? "active" : ""}`} onClick={() => setIsTogglerActive(!isTogglerActive)} type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                  <span className="toggler-icon"></span>
                  <span className="toggler-icon"></span>
                  <span className="toggler-icon"></span>
                </button>

                <div className={`collapse navbar-collapse sub-menu-bar ${isTogglerActive ? "show" : ""}`} id="navbarSupportedContent">
                  <div className="ms-auto">
                    <ul id="nav" className="navbar-nav ms-auto">
                      {menuItems.map(item =>
                        <li key={item.label} className="nav-item">
                          <a className={`nav-link page-scroll ${activeLink === `/${item.url}` ? "active" : ""}`} href={`/${item.url}`} onClick={() => setIsTogglerActive(false)}>{item.label}</a>
                        </li>
                      )}
                    </ul>
                  </div>
                </div> {/* <!-- navbar collapse --> */}
              </nav> {/* <!-- navbar --> */}
            </div>
          </div> {/* <!-- row --> */}
        </div> {/* <!-- container --> */}
      </div> {/* <!-- navbar area --> */}
    </header>
  )
}

export default Header;
