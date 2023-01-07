import React, { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import Header from "./Header"
import Footer from "./Footer"
import ScrollToTop from "../containers/ScrollToTop"

import "../assets/css/bootstrap.min.css"
import "../assets/css/lineicons.css"
import "../assets/css/tiny-slider.css"
import "../assets/css/main.css"

const Layout = ({ children, menuItems }) => {
  const [activeLink, setActiveLink] = useState("");
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => {
      const sections = document.querySelectorAll('.page-scroll');
      const scrollPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;

      for (let i = 0; i < sections.length; i++) {
        const currLink = sections[i];
        const currLinkHref = currLink.getAttribute('href');
        const val = currLinkHref.replace("/", "");
        const refElement = document.querySelector(val);
        const scrollTopMinus = scrollPos + 73;

        if (refElement && refElement.offsetTop <= scrollTopMinus && (refElement.offsetTop + refElement.offsetHeight > scrollTopMinus)) {
          setActiveLink(currLinkHref)
        }
      }
    };

    window.document.addEventListener('scroll', onScroll, { passive: true });
    return () => window.document.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (location.hash) {
      let elem = document.getElementById(location.hash.slice(1))
      if (elem) elem.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
    }
  }, [location])

  return (
    <>
      <Header menuItems={menuItems} activeLink={activeLink} />

      {children}

      <ScrollToTop />

      <Footer menuItems={menuItems} activeLink={activeLink} />
    </>
  )
}

export default Layout;
