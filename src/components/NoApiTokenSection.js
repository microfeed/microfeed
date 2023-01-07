import * as React from "react"

const NoApiTokenSection = () => {
  return (
    <section id="home" className="hero-section">
      <div className="container">
        <div className="row align-items-center">
          <div className="col-xl-6 col-lg-6 col-md-10">
            <div className="hero-content">
              <h1>Configure your ButterCMS API Token</h1>
              <p>Please add your API token to your <i>.env</i> file.</p>
              <a target="_blank" rel="noreferrer" href="https://buttercms.com/join/" className="main-btn btn-hover">
                Get your free API token
              </a>
            </div>
          </div>
          <div className="col-xxl-6 col-xl-6 col-lg-6">
            <img width="300" src="https://cdn.buttercms.com/9bPtzdJ6QSWkySNjlmyR" alt="" />
            <div className="hero-image text-center text-lg-end"></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default NoApiTokenSection;


