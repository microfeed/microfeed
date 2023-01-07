import * as React from "react"

const Testimonial = (props) => {
  return (
    <div className="single-testimonial">
      <div className="quote">
        <i className="lni lni-quotation"></i>
      </div>
      <div className="content">
        <p>{props.quote}</p>
      </div>
      <div className="info">
        <h6>{props.name}</h6>
        <p>{props.title}</p>
      </div>
    </div>
  )
}

export default Testimonial;
