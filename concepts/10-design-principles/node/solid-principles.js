/**
 * SOLID Principles Implementation
 * Demonstrates all five SOLID principles with practical examples
 */

/**
 * S - Single Responsibility Principle (SRP)
 * A class should have only one reason to change
 */

// ❌ BAD: Violates SRP - handles both user data and email
class UserBad {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  save() {
    // Save to database
    console.log(`Saving user ${this.name} to database`);
  }

  sendEmail(message) {
    // Send email
    console.log(`Sending email to ${this.email}: ${message}`);
  }
}

// ✅ GOOD: Separates concerns
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  getName() {
    return this.name;
  }

  getEmail() {
    return this.email;
  }
}

class UserRepository {
  save(user) {
    console.log(`Saving user ${user.getName()} to database`);
    // Database logic here
  }

  findById(id) {
    console.log(`Finding user with id: ${id}`);
    // Database query here
    return null;
  }
}

class EmailService {
  sendEmail(user, message) {
    console.log(`Sending email to ${user.getEmail()}: ${message}`);
    // Email sending logic here
  }
}

/**
 * O - Open/Closed Principle (OCP)
 * Open for extension, closed for modification
 */

// ✅ GOOD: Extensible without modification
class Shape {
  area() {
    throw new Error('area() must be implemented');
  }
}

class Rectangle extends Shape {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
  }

  area() {
    return this.width * this.height;
  }
}

class Circle extends Shape {
  constructor(radius) {
    super();
    this.radius = radius;
  }

  area() {
    return Math.PI * this.radius * this.radius;
  }
}

class Triangle extends Shape {
  constructor(base, height) {
    super();
    this.base = base;
    this.height = height;
  }

  area() {
    return 0.5 * this.base * this.height;
  }
}

// Area calculator doesn't need modification when adding new shapes
class AreaCalculator {
  calculateTotalArea(shapes) {
    return shapes.reduce((total, shape) => total + shape.area(), 0);
  }
}

/**
 * L - Liskov Substitution Principle (LSP)
 * Subtypes must be substitutable for their base types
 */

// ✅ GOOD: All birds can be substituted
class Bird {
  move() {
    throw new Error('move() must be implemented');
  }
}

class FlyingBird extends Bird {
  fly() {
    throw new Error('fly() must be implemented');
  }

  move() {
    this.fly();
  }
}

class WalkingBird extends Bird {
  walk() {
    throw new Error('walk() must be implemented');
  }

  move() {
    this.walk();
  }
}

class Sparrow extends FlyingBird {
  fly() {
    console.log('Sparrow is flying');
  }
}

class Penguin extends WalkingBird {
  walk() {
    console.log('Penguin is walking');
  }
}

// Function works with any Bird subtype
function makeBirdMove(bird) {
  bird.move(); // Works for both Sparrow and Penguin
}

/**
 * I - Interface Segregation Principle (ISP)
 * Clients shouldn't depend on interfaces they don't use
 */

// ❌ BAD: Fat interface
class WorkerBad {
  work() {}
  eat() {}
  sleep() {}
}

// ✅ GOOD: Segregated interfaces
class Workable {
  work() {
    throw new Error('work() must be implemented');
  }
}

class Eatable {
  eat() {
    throw new Error('eat() must be implemented');
  }
}

class Sleepable {
  sleep() {
    throw new Error('sleep() must be implemented');
  }
}

class HumanWorker extends Workable {
  work() {
    console.log('Human is working');
  }
}

class RobotWorker extends Workable {
  work() {
    console.log('Robot is working');
  }
  // No need to implement eat() or sleep()
}

/**
 * D - Dependency Inversion Principle (DIP)
 * Depend on abstractions, not concretions
 */

// ❌ BAD: Depends on concrete implementation
class MySQLDatabase {
  save(data) {
    console.log(`Saving to MySQL: ${data}`);
  }
}

class UserServiceBad {
  constructor() {
    this.database = new MySQLDatabase(); // Tight coupling
  }

  saveUser(user) {
    this.database.save(user);
  }
}

// ✅ GOOD: Depends on abstraction
class Database {
  save(data) {
    throw new Error('save() must be implemented');
  }
}

class MySQLDatabase extends Database {
  save(data) {
    console.log(`Saving to MySQL: ${data}`);
  }
}

class PostgreSQLDatabase extends Database {
  save(data) {
    console.log(`Saving to PostgreSQL: ${data}`);
  }
}

class MongoDBDatabase extends Database {
  save(data) {
    console.log(`Saving to MongoDB: ${data}`);
  }
}

class UserService {
  constructor(database) {
    this.database = database; // Depends on abstraction
  }

  saveUser(user) {
    this.database.save(user);
  }
}

// Example usage
function demonstrateSOLID() {
  console.log('=== Single Responsibility Principle ===\n');
  const user = new User('John Doe', 'john@example.com');
  const userRepo = new UserRepository();
  const emailService = new EmailService();
  
  userRepo.save(user);
  emailService.sendEmail(user, 'Welcome!');

  console.log('\n=== Open/Closed Principle ===\n');
  const shapes = [
    new Rectangle(5, 4),
    new Circle(3),
    new Triangle(4, 3)
  ];
  const calculator = new AreaCalculator();
  const totalArea = calculator.calculateTotalArea(shapes);
  console.log(`Total area: ${totalArea.toFixed(2)}`);

  console.log('\n=== Liskov Substitution Principle ===\n');
  const sparrow = new Sparrow();
  const penguin = new Penguin();
  makeBirdMove(sparrow);
  makeBirdMove(penguin);

  console.log('\n=== Interface Segregation Principle ===\n');
  const human = new HumanWorker();
  const robot = new RobotWorker();
  human.work();
  robot.work();

  console.log('\n=== Dependency Inversion Principle ===\n');
  const mysqlDB = new MySQLDatabase();
  const postgresDB = new PostgreSQLDatabase();
  const userService1 = new UserService(mysqlDB);
  const userService2 = new UserService(postgresDB);
  
  userService1.saveUser('User1');
  userService2.saveUser('User2');
}

if (require.main === module) {
  demonstrateSOLID();
}

module.exports = {
  // SRP
  User,
  UserRepository,
  EmailService,
  // OCP
  Shape,
  Rectangle,
  Circle,
  Triangle,
  AreaCalculator,
  // LSP
  Bird,
  FlyingBird,
  WalkingBird,
  Sparrow,
  Penguin,
  // ISP
  Workable,
  Eatable,
  Sleepable,
  HumanWorker,
  RobotWorker,
  // DIP
  Database,
  MySQLDatabase,
  PostgreSQLDatabase,
  MongoDBDatabase,
  UserService
};

