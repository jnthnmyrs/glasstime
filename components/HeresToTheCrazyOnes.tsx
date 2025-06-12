"use client";

export default function HeresToTheCrazyOnes() {
  return (
    <div className="crazy-ones-container">
      <h1 className="crazy-ones-title">
        {`Here's to the crazy ones.`}
      </h1>
      
      <div className="crazy-ones-content">
        <p>
          {`The misfits. The rebels. The troublemakers. The round pegs in the 
          square holes. The ones who see things differently.`}
        </p>
        
        <p>
          {`They're not fond of rules. And they have no respect for the status quo. 
          You can quote them, disagree with them, glorify or vilify them. 
          About the only thing you can't do is ignore them.`}
        </p>
        
        <p>
          {`Because they change things. They push the human race forward. 
          And while some may see them as the crazy ones, we see genius.`}
        </p>
        
        <p className="crazy-ones-emphasis">
          {`Because the people who are crazy enough to think they can change 
          the world, are the ones who do.`}
        </p>
      </div>
      
      <div className="crazy-ones-attribution">
        <div>Think Different</div>
        <div>Apple Inc.</div>
      </div>
    </div>
  );
}
